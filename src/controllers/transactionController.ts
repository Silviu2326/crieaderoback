import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  startOfMonth, endOfMonth, startOfYear, endOfYear,
  subMonths, startOfWeek, endOfWeek, eachDayOfInterval,
  eachMonthOfInterval, format, isSameMonth, isSameDay
} from 'date-fns';

const prisma = new PrismaClient();

// Get default categories for a kennel
const getDefaultCategories = (kennelId: string) => [
  // Income categories
  { name: 'Venta de perros', type: 'INCOME', color: '#34c759', isDefault: true, kennelId },
  { name: 'Señales/Reservas', type: 'INCOME', color: '#34c759', isDefault: true, kennelId },
  { name: 'Servicios de monta', type: 'INCOME', color: '#34c759', isDefault: true, kennelId },
  { name: 'Otros ingresos', type: 'INCOME', color: '#34c759', isDefault: true, kennelId },
  // Expense categories
  { name: 'Alimentación', type: 'EXPENSE', color: '#ff3b30', isDefault: true, kennelId },
  { name: 'Veterinario', type: 'EXPENSE', color: '#ff3b30', isDefault: true, kennelId },
  { name: 'Medicinas', type: 'EXPENSE', color: '#ff3b30', isDefault: true, kennelId },
  { name: 'Equipamiento', type: 'EXPENSE', color: '#ff3b30', isDefault: true, kennelId },
  { name: 'Transporte', type: 'EXPENSE', color: '#ff3b30', isDefault: true, kennelId },
  { name: 'Marketing', type: 'EXPENSE', color: '#ff3b30', isDefault: true, kennelId },
  { name: 'Otros gastos', type: 'EXPENSE', color: '#ff3b30', isDefault: true, kennelId },
];

// Initialize default categories for a kennel
export const initializeCategories = async (kennelId: string) => {
  const existingCategories = await prisma.transactionCategory.findMany({
    where: { kennelId },
  });

  if (existingCategories.length === 0) {
    const defaults = getDefaultCategories(kennelId);
    await prisma.transactionCategory.createMany({
      data: defaults,
    });
  }
};

// Get all transactions for a kennel
export const getTransactions = async (req: Request, res: Response) => {
  try {
    const { kennelId } = req.params;
    const { type, categoryId, startDate, endDate, limit = '50', offset = '0' } = req.query;

    const where: any = { kennelId };

    if (type) where.type = type;
    if (categoryId) where.categoryId = categoryId;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        category: true,
        dog: { select: { id: true, name: true, breed: { select: { name: true } } } },
        customer: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { date: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.transaction.count({ where });

    res.json({ transactions, total });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Error fetching transactions' });
  }
};

// Get transaction by ID
export const getTransactionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        category: true,
        dog: { select: { id: true, name: true, breed: { select: { name: true } } } },
        customer: { select: { id: true, firstName: true, lastName: true } },
        invoice: true,
      },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ transaction });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ error: 'Error fetching transaction' });
  }
};

// Create transaction
export const createTransaction = async (req: Request, res: Response) => {
  try {
    const { kennelId } = req.params;
    const {
      type,
      amount,
      date,
      description,
      notes,
      categoryId,
      paymentMethod,
      reference,
      dogId,
      customerId,
      reservationId,
    } = req.body;

    // Validate required fields
    if (!type || !amount || !date || !description || !categoryId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify category exists and belongs to kennel
    const category = await prisma.transactionCategory.findFirst({
      where: { id: categoryId, kennelId },
    });

    if (!category) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const transaction = await prisma.transaction.create({
      data: {
        type,
        amount: parseFloat(amount),
        date: new Date(date),
        description,
        notes,
        categoryId,
        paymentMethod,
        reference,
        kennelId,
        dogId,
        customerId,
        reservationId,
        createdBy: req.user?.id || '',
      },
      include: {
        category: true,
        dog: { select: { id: true, name: true } },
        customer: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.status(201).json({ transaction, message: 'Transaction created successfully' });
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ error: 'Error creating transaction' });
  }
};

// Update transaction
export const updateTransaction = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      type,
      amount,
      date,
      description,
      notes,
      categoryId,
      paymentMethod,
      reference,
      status,
      dogId,
      customerId,
    } = req.body;

    const transaction = await prisma.transaction.update({
      where: { id },
      data: {
        type,
        amount: amount ? parseFloat(amount) : undefined,
        date: date ? new Date(date) : undefined,
        description,
        notes,
        categoryId,
        paymentMethod,
        reference,
        status,
        dogId,
        customerId,
      },
      include: {
        category: true,
        dog: { select: { id: true, name: true } },
        customer: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.json({ transaction, message: 'Transaction updated successfully' });
  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({ error: 'Error updating transaction' });
  }
};

// Delete transaction
export const deleteTransaction = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.transaction.delete({
      where: { id },
    });

    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ error: 'Error deleting transaction' });
  }
};

// Get categories
export const getCategories = async (req: Request, res: Response) => {
  try {
    const { kennelId } = req.params;
    const { type } = req.query;

    // Initialize default categories if none exist
    await initializeCategories(kennelId);

    const where: any = { kennelId };
    if (type) where.type = type;

    const categories = await prisma.transactionCategory.findMany({
      where,
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    res.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Error fetching categories' });
  }
};

// Create category
export const createCategory = async (req: Request, res: Response) => {
  try {
    const { kennelId } = req.params;
    const { name, type, color, icon, description } = req.body;

    const category = await prisma.transactionCategory.create({
      data: {
        name,
        type,
        color,
        icon,
        description,
        kennelId,
      },
    });

    res.status(201).json({ category, message: 'Category created successfully' });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Error creating category' });
  }
};

// Update category
export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, color, icon, description, isActive } = req.body;

    const category = await prisma.transactionCategory.update({
      where: { id },
      data: { name, color, icon, description, isActive },
    });

    res.json({ category, message: 'Category updated successfully' });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Error updating category' });
  }
};

// Delete category
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if category has transactions
    const transactionCount = await prisma.transaction.count({
      where: { categoryId: id },
    });

    if (transactionCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete category with existing transactions',
        transactionCount,
      });
    }

    await prisma.transactionCategory.delete({
      where: { id },
    });

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Error deleting category' });
  }
};

// Get financial summary
export const getFinancialSummary = async (req: Request, res: Response) => {
  try {
    const { kennelId } = req.params;
    const { period = 'month' } = req.query;

    let startDate: Date;
    let endDate: Date;
    let trendData: any[] = [];

    const now = new Date();

    const fetchTransactions = async (start: Date, end: Date) => {
      return prisma.transaction.findMany({
        where: {
          kennelId,
          status: 'COMPLETED',
          date: { gte: start, lte: end },
        },
        include: { category: true },
      });
    };

    const fetchInvoices = async (start: Date, end: Date) => {
      return prisma.invoice.findMany({
        where: {
          kennelId,
          issueDate: { gte: start, lte: end },
        },
      });
    };

    const calcIncome = (txs: any[], invs: any[]) => {
      const regularIncome = txs
        .filter((t) => t.type === 'INCOME' && !t.invoiceId)
        .reduce((sum, t) => sum + t.amount, 0);
      const invoiceIncome = invs.reduce((sum, inv) => sum + inv.total, 0);
      return regularIncome + invoiceIncome;
    };

    const calcExpenses = (txs: any[]) => {
      return txs
        .filter((t) => t.type === 'EXPENSE')
        .reduce((sum, t) => sum + t.amount, 0);
    };

    if (period === 'week') {
      // Week view: show daily data for current week
      startDate = startOfWeek(now, { weekStartsOn: 1 }); // Monday
      endDate = endOfWeek(now, { weekStartsOn: 1 });

      const [transactions, invoices] = await Promise.all([
        fetchTransactions(startDate, endDate),
        fetchInvoices(startDate, endDate),
      ]);

      // Generate daily trend data
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
      trendData = days.map((day, index) => {
        const dayTransactions = transactions.filter(t =>
          isSameDay(new Date(t.date), day)
        );
        const dayInvoices = invoices.filter(inv =>
          isSameDay(new Date(inv.issueDate), day)
        );
        const income = calcIncome(dayTransactions, dayInvoices);
        const expenses = calcExpenses(dayTransactions);

        return {
          month: dayNames[index], // Lun, Mar, Mié, etc.
          date: format(day, 'yyyy-MM-dd'),
          income,
          expenses,
          balance: income - expenses,
        };
      });

    } else if (period === 'month') {
      // Month view: show daily data for current month
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);

      const [transactions, invoices] = await Promise.all([
        fetchTransactions(startDate, endDate),
        fetchInvoices(startDate, endDate),
      ]);

      // Generate daily trend data
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      trendData = days.map(day => {
        const dayTransactions = transactions.filter(t =>
          isSameDay(new Date(t.date), day)
        );
        const dayInvoices = invoices.filter(inv =>
          isSameDay(new Date(inv.issueDate), day)
        );
        const income = calcIncome(dayTransactions, dayInvoices);
        const expenses = calcExpenses(dayTransactions);

        return {
          month: format(day, 'd'), // 1, 2, 3, etc.
          date: format(day, 'yyyy-MM-dd'),
          income,
          expenses,
          balance: income - expenses,
        };
      });

    } else if (period === 'year') {
      // Year view: show monthly data for current year
      startDate = startOfYear(now);
      endDate = endOfYear(now);

      const [transactions, invoices] = await Promise.all([
        fetchTransactions(startDate, endDate),
        fetchInvoices(startDate, endDate),
      ]);

      // Generate monthly trend data
      const months = eachMonthOfInterval({ start: startDate, end: endDate });
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      trendData = months.map((month, index) => {
        const monthTransactions = transactions.filter(t =>
          isSameMonth(new Date(t.date), month)
        );
        const monthInvoices = invoices.filter(inv =>
          isSameMonth(new Date(inv.issueDate), month)
        );
        const income = calcIncome(monthTransactions, monthInvoices);
        const expenses = calcExpenses(monthTransactions);

        return {
          month: monthNames[month.getMonth()], // Ene, Feb, etc.
          date: format(month, 'yyyy-MM'),
          income,
          expenses,
          balance: income - expenses,
        };
      });

    } else if (period === 'lastMonth') {
      // Last month: show daily data for last month
      const lastMonth = subMonths(now, 1);
      startDate = startOfMonth(lastMonth);
      endDate = endOfMonth(lastMonth);

      const [transactions, invoices] = await Promise.all([
        fetchTransactions(startDate, endDate),
        fetchInvoices(startDate, endDate),
      ]);

      // Generate daily trend data for last month
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      trendData = days.map(day => {
        const dayTransactions = transactions.filter(t =>
          isSameDay(new Date(t.date), day)
        );
        const dayInvoices = invoices.filter(inv =>
          isSameDay(new Date(inv.issueDate), day)
        );
        const income = calcIncome(dayTransactions, dayInvoices);
        const expenses = calcExpenses(dayTransactions);

        return {
          month: format(day, 'd'),
          date: format(day, 'yyyy-MM-dd'),
          income,
          expenses,
          balance: income - expenses,
        };
      });

    } else {
      // Custom range - fallback to daily grouping
      startDate = new Date(req.query.startDate as string);
      endDate = new Date(req.query.endDate as string);

      const [transactions, invoices] = await Promise.all([
        fetchTransactions(startDate, endDate),
        fetchInvoices(startDate, endDate),
      ]);

      const days = eachDayOfInterval({ start: startDate, end: endDate });
      trendData = days.map(day => {
        const dayTransactions = transactions.filter(t =>
          isSameDay(new Date(t.date), day)
        );
        const dayInvoices = invoices.filter(inv =>
          isSameDay(new Date(inv.issueDate), day)
        );
        const income = calcIncome(dayTransactions, dayInvoices);
        const expenses = calcExpenses(dayTransactions);

        return {
          month: format(day, 'd MMM'),
          date: format(day, 'yyyy-MM-dd'),
          income,
          expenses,
          balance: income - expenses,
        };
      });
    }

    // Get all transactions and invoices for summary and breakdown
    const [transactions, invoices] = await Promise.all([
      fetchTransactions(startDate, endDate),
      fetchInvoices(startDate, endDate),
    ]);

    const regularIncomeTransactions = transactions.filter((t) => t.type === 'INCOME' && !t.invoiceId);
    const invoiceIncomeTotal = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const income = regularIncomeTransactions.reduce((sum, t) => sum + t.amount, 0) + invoiceIncomeTotal;

    const expenses = transactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);

    const balance = income - expenses;

    // Get income by category
    const incomeByCategory = regularIncomeTransactions.reduce((acc, t) => {
      const categoryName = t.category?.name || 'Unknown';
      acc[categoryName] = (acc[categoryName] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);
    if (invoiceIncomeTotal > 0) {
      incomeByCategory['Facturación'] = (incomeByCategory['Facturación'] || 0) + invoiceIncomeTotal;
    }

    // Get expenses by category
    const expensesByCategory = transactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((acc, t) => {
        const categoryName = t.category?.name || 'Unknown';
        acc[categoryName] = (acc[categoryName] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);

    // Calculate trends vs previous period
    const prevStartDate = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
    const [prevTransactions, prevInvoices] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          kennelId,
          status: 'COMPLETED',
          date: {
            gte: prevStartDate,
            lt: startDate,
          },
        },
      }),
      prisma.invoice.findMany({
        where: {
          kennelId,
          issueDate: {
            gte: prevStartDate,
            lt: startDate,
          },
        },
      }),
    ]);

    const prevIncome = prevTransactions
      .filter(t => t.type === 'INCOME' && !t.invoiceId)
      .reduce((sum, t) => sum + t.amount, 0)
      + prevInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const prevExpenses = prevTransactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);
    const prevBalance = prevIncome - prevExpenses;

    const trends = {
      income: prevIncome > 0 ? ((income - prevIncome) / prevIncome) * 100 : 0,
      expenses: prevExpenses > 0 ? ((expenses - prevExpenses) / prevExpenses) * 100 : 0,
      balance: prevBalance !== 0 ? ((balance - prevBalance) / Math.abs(prevBalance)) * 100 : 0,
    };

    res.json({
      summary: {
        income,
        expenses,
        balance,
        transactionCount: transactions.length,
      },
      breakdown: {
        incomeByCategory,
        expensesByCategory,
      },
      monthlyTrend: trendData,
      trends,
      period: {
        start: startDate,
        end: endDate,
      },
    });
  } catch (error) {
    console.error('Get financial summary error:', error);
    res.status(500).json({ error: 'Error fetching financial summary' });
  }
};
