import { Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

// List customers
export const listCustomers = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, search, isArchived } = req.query;
  const user = req.user!;

  const where: any = {};

  if (kennelId) where.kennelId = kennelId as string;
  if (isArchived !== undefined) where.isArchived = isArchived === 'true';

  if (search) {
    where.OR = [
      { firstName: { contains: search as string, mode: 'insensitive' } },
      { lastName: { contains: search as string, mode: 'insensitive' } },
      { email: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  // Access control
  if (user.role === 'BREEDER') {
    const effectiveKennelId = (kennelId as string) || user.kennelId;
    if (effectiveKennelId !== user.kennelId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!kennelId) {
      where.kennelId = user.kennelId;
    }
  }

  const customers = await prisma.customer.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          avatarUrl: true,
        },
      },
      _count: {
        select: {
          reservations: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ customers });
});

// Get customer
export const getCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          avatarUrl: true,
          createdAt: true,
        },
      },
      reservations: {
        include: {
          dog: {
            select: {
              id: true,
              name: true,
              breed: { select: { name: true } },
              photos: { where: { isMain: true }, take: 1 },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  // Access control
  if (user.role === 'BREEDER') {
    const kennel = await prisma.kennel.findUnique({
      where: { id: customer.kennelId },
    });
    if (kennel?.breederId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  res.json({ customer });
});

// Create customer
export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const { kennelId, firstName, lastName, email, phone, address, city, notes } = req.body;

  // Check access
  if (user.role === 'BREEDER') {
    const resolvedKennelId = kennelId || user.kennelId;
    const kennel = await prisma.kennel.findUnique({
      where: { id: resolvedKennelId },
    });
    if (!kennel || kennel.breederId !== user.id) {
      return res.status(403).json({ error: 'Access denied to this kennel' });
    }
  }

  // Check if email already exists for this kennel
  const existing = await prisma.customer.findUnique({
    where: {
      kennelId_email: {
        kennelId,
        email,
      },
    },
  });

  if (existing) {
    return res.status(409).json({ error: 'Customer with this email already exists in this kennel' });
  }

  // Check if there's a registered user with this email
  const userAccount = await prisma.user.findUnique({
    where: { email },
  });

  const customer = await prisma.customer.create({
    data: {
      kennelId,
      userId: userAccount?.id,
      firstName,
      lastName,
      email,
      phone,
      address,
      city,
      notes,
    },
    include: {
      user: {
        select: {
          id: true,
          avatarUrl: true,
        },
      },
    },
  });

  res.status(201).json({ customer });
});

// Update customer
export const updateCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;
  const { firstName, lastName, email, phone, address, city, notes, isArchived } = req.body;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { kennel: true },
  });

  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  if (user.role === 'BREEDER' && customer.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Check email uniqueness if changed
  if (email && email !== customer.email) {
    const existing = await prisma.customer.findUnique({
      where: {
        kennelId_email: {
          kennelId: customer.kennelId,
          email,
        },
      },
    });
    if (existing) {
      return res.status(409).json({ error: 'Customer with this email already exists' });
    }
  }

  const updatedCustomer = await prisma.customer.update({
    where: { id },
    data: {
      firstName,
      lastName,
      email,
      phone,
      address,
      city,
      notes,
      isArchived,
    },
    include: {
      user: {
        select: {
          id: true,
          avatarUrl: true,
        },
      },
    },
  });

  res.json({ customer: updatedCustomer });
});

// Delete customer
export const deleteCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { kennel: true },
  });

  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  if (user.role === 'BREEDER' && customer.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Check for active reservations
  const activeReservations = await prisma.reservation.findFirst({
    where: {
      customerId: id,
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
  });

  if (activeReservations) {
    return res.status(400).json({
      error: 'Cannot delete customer with active reservations',
    });
  }

  await prisma.customer.delete({ where: { id } });

  res.json({ message: 'Customer deleted' });
});

// Archive customer
export const archiveCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { kennel: true },
  });

  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  if (user.role === 'BREEDER' && customer.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const updatedCustomer = await prisma.customer.update({
    where: { id },
    data: { isArchived: !customer.isArchived },
  });

  res.json({
    message: `Customer ${updatedCustomer.isArchived ? 'archived' : 'unarchived'}`,
    customer: updatedCustomer,
  });
});

// Link customer to user account
export const linkCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;
  const { userId } = req.body;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { kennel: true },
  });

  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  if (user.role === 'BREEDER' && customer.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Update customer with user link
  const updatedCustomer = await prisma.customer.update({
    where: { id },
    data: { userId },
  });

  res.json({ customer: updatedCustomer });
});
