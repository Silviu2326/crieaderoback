import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { startOfMonth, endOfMonth, addDays } from 'date-fns';

const prisma = new PrismaClient();

// Generate invoice number
const generateInvoiceNumber = async (kennelId: string): Promise<string> => {
  const date = new Date();
  const year = date.getFullYear();
  const prefix = `INV-${year}-`;

  const count = await prisma.invoice.count({
    where: {
      kennelId,
      number: { startsWith: prefix },
    },
  });

  return `${prefix}${String(count + 1).padStart(4, '0')}`;
};

// Get all invoices
export const getInvoices = async (req: Request, res: Response) => {
  try {
    const { kennelId } = req.params;
    const { status, customerId, startDate, endDate, limit = '50', offset = '0' } = req.query;

    const where: any = { kennelId };

    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (startDate || endDate) {
      where.issueDate = {};
      if (startDate) where.issueDate.gte = new Date(startDate as string);
      if (endDate) where.issueDate.lte = new Date(endDate as string);
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
        items: { include: { dog: { select: { id: true, name: true, breed: { select: { name: true } } } } } },
        transactions: { select: { id: true, amount: true, date: true } },
      },
      orderBy: { issueDate: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.invoice.count({ where });

    // Calculate total paid per invoice
    const invoicesWithPayments = invoices.map((invoice) => {
      const totalPaid = invoice.transactions.reduce((sum, t) => sum + t.amount, 0);
      const balance = invoice.total - totalPaid;
      return { ...invoice, totalPaid, balance };
    });

    res.json({ invoices: invoicesWithPayments, total });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Error fetching invoices' });
  }
};

// Get invoice by ID
export const getInvoiceById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, address: true, city: true } },
        items: { include: { dog: { select: { id: true, name: true, breed: { select: { name: true } }, photos: { where: { isMain: true }, take: 1 } } } } },
        transactions: { include: { category: true } },
        kennel: { select: { name: true, address: true, city: true, phone: true, email: true } },
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const totalPaid = invoice.transactions.reduce((sum, t) => sum + t.amount, 0);
    const balance = invoice.total - totalPaid;

    res.json({ invoice: { ...invoice, totalPaid, balance } });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ error: 'Error fetching invoice' });
  }
};

// Create invoice
export const createInvoice = async (req: Request, res: Response) => {
  try {
    const { kennelId } = req.params;
    const { customerId, issueDate, dueDate, items, notes, taxRate = 21 } = req.body;

    // Validate required fields
    if (!customerId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Customer and items are required' });
    }

    // Calculate totals
    const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;

    // Generate invoice number
    const number = await generateInvoiceNumber(kennelId);

    const invoice = await prisma.invoice.create({
      data: {
        number,
        issueDate: new Date(issueDate || new Date()),
        dueDate: dueDate ? new Date(dueDate) : addDays(new Date(), 30),
        subtotal,
        taxRate,
        taxAmount,
        total,
        notes,
        kennelId,
        customerId,
        items: {
          create: items.map((item: any) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
            dogId: item.dogId,
          })),
        },
      },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
        items: { include: { dog: { select: { id: true, name: true } } } },
      },
    });

    res.status(201).json({ invoice, message: 'Invoice created successfully' });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'Error creating invoice' });
  }
};

// Update invoice
export const updateInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { dueDate, notes, status } = req.body;

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        dueDate: dueDate ? new Date(dueDate) : undefined,
        notes,
        status,
      },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true } },
        items: true,
      },
    });

    res.json({ invoice, message: 'Invoice updated successfully' });
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({ error: 'Error updating invoice' });
  }
};

// Delete invoice
export const deleteInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if invoice has payments
    const payments = await prisma.transaction.count({
      where: { invoiceId: id },
    });

    if (payments > 0) {
      return res.status(400).json({ error: 'Cannot delete invoice with payments' });
    }

    await prisma.invoice.delete({
      where: { id },
    });

    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ error: 'Error deleting invoice' });
  }
};

// Record payment for invoice
export const recordPayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, date, paymentMethod, notes, categoryId } = req.body;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { kennel: true, customer: true },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Get or create income category for invoice payments
    let incomeCategoryId = categoryId;
    if (!incomeCategoryId) {
      const category = await prisma.transactionCategory.findFirst({
        where: { kennelId: invoice.kennelId, type: 'INCOME', name: 'Venta de perros' },
      });
      if (category) {
        incomeCategoryId = category.id;
      }
    }

    // Create transaction for payment
    const transaction = await prisma.transaction.create({
      data: {
        type: 'INCOME',
        amount: parseFloat(amount),
        date: new Date(date || new Date()),
        description: `Pago factura ${invoice.number}`,
        notes,
        paymentMethod,
        kennelId: invoice.kennelId,
        customerId: invoice.customerId,
        invoiceId: id,
        categoryId: incomeCategoryId || '',
        createdBy: req.user?.id || '',
      },
    });

    // Update invoice status if fully paid
    const totalPaid = await prisma.transaction.aggregate({
      where: { invoiceId: id },
      _sum: { amount: true },
    });

    const newStatus = (totalPaid._sum.amount || 0) >= invoice.total ? 'PAID' : 'PENDING';

    await prisma.invoice.update({
      where: { id },
      data: { status: newStatus },
    });

    res.json({ transaction, message: 'Payment recorded successfully' });
  } catch (error) {
    console.error('Record payment error:', error);
    res.status(500).json({ error: 'Error recording payment' });
  }
};

// Get overdue invoices
export const getOverdueInvoices = async (req: Request, res: Response) => {
  try {
    const { kennelId } = req.params;

    const invoices = await prisma.invoice.findMany({
      where: {
        kennelId,
        status: { in: ['PENDING', 'OVERDUE'] },
        dueDate: { lt: new Date() },
      },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        transactions: { select: { amount: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const overdueInvoices = invoices.map((invoice) => {
      const totalPaid = invoice.transactions.reduce((sum, t) => sum + t.amount, 0);
      const balance = invoice.total - totalPaid;
      const daysOverdue = invoice.dueDate
        ? Math.floor((new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      return { ...invoice, totalPaid, balance, daysOverdue };
    });

    const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + inv.balance, 0);

    res.json({ invoices: overdueInvoices, totalOverdue, count: overdueInvoices.length });
  } catch (error) {
    console.error('Get overdue invoices error:', error);
    res.status(500).json({ error: 'Error fetching overdue invoices' });
  }
};

// Get invoice statistics
export const getInvoiceStats = async (req: Request, res: Response) => {
  try {
    const { kennelId } = req.params;
    const { year = new Date().getFullYear() } = req.query;

    const startDate = new Date(Number(year), 0, 1);
    const endDate = new Date(Number(year), 11, 31);

    const invoices = await prisma.invoice.findMany({
      where: {
        kennelId,
        issueDate: { gte: startDate, lte: endDate },
      },
      include: {
        transactions: { select: { amount: true } },
      },
    });

    const stats = {
      totalInvoiced: invoices.reduce((sum, inv) => sum + inv.total, 0),
      totalPaid: invoices.reduce((sum, inv) => {
        return sum + inv.transactions.reduce((tSum, t) => tSum + t.amount, 0);
      }, 0),
      totalPending: 0,
      totalOverdue: 0,
      countByStatus: {
        PENDING: 0,
        PAID: 0,
        OVERDUE: 0,
        CANCELLED: 0,
      },
    };

    invoices.forEach((inv) => {
      const paid = inv.transactions.reduce((sum, t) => sum + t.amount, 0);
      stats.countByStatus[inv.status as keyof typeof stats.countByStatus]++;

      if (inv.status === 'OVERDUE') {
        stats.totalOverdue += inv.total - paid;
      } else if (inv.status === 'PENDING') {
        stats.totalPending += inv.total - paid;
      }
    });

    res.json(stats);
  } catch (error) {
    console.error('Get invoice stats error:', error);
    res.status(500).json({ error: 'Error fetching invoice statistics' });
  }
};
