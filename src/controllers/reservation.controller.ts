import { Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
import { sendReservationNotification } from '../utils/email';

// List reservations
export const listReservations = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, status, customerId, dogId } = req.query;
  const user = req.user!;

  const where: any = {};

  if (kennelId) where.kennelId = kennelId as string;
  if (status) where.status = status;
  if (customerId) where.customerId = customerId as string;
  if (dogId) where.dogId = dogId as string;

  // Customers see only their own reservations
  if (user.role === 'CUSTOMER') {
    const customer = await prisma.customer.findFirst({
      where: { userId: user.id },
    });
    where.customerId = customer?.id;
  }

  // Breeders see reservations from their kennels
  if (user.role === 'BREEDER') {
    const effectiveKennelId = (kennelId as string) || user.kennelId;
    if (effectiveKennelId !== user.kennelId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!kennelId) {
      where.kennelId = user.kennelId;
    }
  }

  const reservations = await prisma.reservation.findMany({
    where,
    include: {
      kennel: { select: { id: true, name: true } },
      dog: {
        include: {
          breed: { select: { name: true } },
          photos: { where: { isMain: true }, take: 1 },
        },
      },
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ reservations });
});

// Get single reservation
export const getReservation = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      kennel: { select: { id: true, name: true, breederId: true } },
      dog: {
        include: {
          breed: { select: { name: true } },
          photos: { where: { isMain: true }, take: 1 },
        },
      },
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          address: true,
          city: true,
        },
      },
    },
  });

  if (!reservation) {
    return res.status(404).json({ error: 'Reservation not found' });
  }

  // Access control
  if (user.role === 'BREEDER' && reservation.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (user.role === 'CUSTOMER') {
    const customer = await prisma.customer.findFirst({
      where: { userId: user.id },
    });
    if (reservation.customerId !== customer?.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  res.json({ reservation });
});

// Create reservation
export const createReservation = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const { dogId, kennelId, customerId, amount, deposit, notes, requestMessage } = req.body;

  // Check dog availability
  const dog = await prisma.dog.findUnique({
    where: { id: dogId },
    include: { kennel: true },
  });

  if (!dog) {
    return res.status(404).json({ error: 'Dog not found' });
  }

  // Check for existing active reservation
  const existingReservation = await prisma.reservation.findFirst({
    where: {
      dogId,
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
  });

  if (existingReservation) {
    return res.status(409).json({ error: 'Dog already has an active reservation' });
  }

  let finalCustomerId = customerId;

  // If customer is making the request themselves
  if (user.role === 'CUSTOMER') {
    // Find or create customer record for this kennel
    let customer = await prisma.customer.findFirst({
      where: {
        userId: user.id,
        kennelId,
      },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          kennelId,
          userId: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        },
      });
    }

    finalCustomerId = customer.id;

    // Check breeder access
    if (user.role === 'BREEDER') {
      if (dog.kennel.breederId !== user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
  }

  // Breeders creating reservation for customer
  if (user.role === 'BREEDER') {
    const resolvedKennelId = kennelId || user.kennelId;
    const kennel = await prisma.kennel.findUnique({
      where: { id: resolvedKennelId },
    });
    if (!kennel || kennel.breederId !== user.id) {
      return res.status(403).json({ error: 'Access denied to this kennel' });
    }
  }

  const reservation = await prisma.reservation.create({
    data: {
      kennelId,
      dogId,
      customerId: finalCustomerId,
      userId: user.role === 'CUSTOMER' ? user.id : undefined,
      amount,
      deposit,
      notes,
      requestMessage,
      status: user.role === 'CUSTOMER' ? 'PENDING' : 'CONFIRMED',
    },
    include: {
      dog: { select: { name: true } },
      customer: { select: { firstName: true, lastName: true, email: true } },
      kennel: { select: { name: true, email: true } },
    },
  });

  // Update dog status if reservation is confirmed
  if (reservation.status === 'CONFIRMED') {
    await prisma.dog.update({
      where: { id: dogId },
      data: { status: 'RESERVED' },
    });
  }

  // Send notifications
  if (user.role === 'CUSTOMER') {
    // Notify breeder
    await sendReservationNotification(
      reservation.kennel.email || '',
      'new',
      {
        dogName: reservation.dog.name,
        kennelName: reservation.kennel.name,
        status: reservation.status,
      }
    );
  } else {
    // Notify customer
    await sendReservationNotification(
      reservation.customer.email || '',
      'confirmed',
      {
        dogName: reservation.dog.name,
        kennelName: reservation.kennel.name,
        status: reservation.status,
      }
    );
  }

  res.status(201).json({ reservation });
});

// Update reservation status
export const updateReservationStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;
  const { status, amount, deposit, notes } = req.body;

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      kennel: true,
      dog: { select: { name: true } },
      customer: { select: { firstName: true, lastName: true, email: true } },
    },
  });

  if (!reservation) {
    return res.status(404).json({ error: 'Reservation not found' });
  }

  // Access control
  if (user.role === 'BREEDER' && reservation.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const oldStatus = reservation.status;

  const updateData: any = {};
  if (status) updateData.status = status;
  if (amount !== undefined) updateData.amount = amount;
  if (deposit !== undefined) updateData.deposit = deposit;
  if (notes !== undefined) updateData.notes = notes;

  if (status === 'COMPLETED') {
    updateData.completedAt = new Date();
  }

  const updatedReservation = await prisma.reservation.update({
    where: { id },
    data: updateData,
    include: {
      dog: {
        include: {
          breed: { select: { name: true } },
          photos: { where: { isMain: true }, take: 1 },
        },
      },
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  // Update dog status based on reservation status
  if (status === 'CONFIRMED' && oldStatus !== 'CONFIRMED') {
    await prisma.dog.update({
      where: { id: reservation.dogId },
      data: { status: 'RESERVED' },
    });

    await sendReservationNotification(
      reservation.customer.email || '',
      'confirmed',
      {
        dogName: reservation.dog.name,
        kennelName: reservation.kennel.name,
        status: 'CONFIRMED',
      }
    );
  } else if (status === 'COMPLETED') {
    await prisma.dog.update({
      where: { id: reservation.dogId },
      data: { status: 'SOLD' },
    });

    await sendReservationNotification(
      reservation.customer.email || '',
      'completed',
      {
        dogName: reservation.dog.name,
        kennelName: reservation.kennel.name,
        status: 'COMPLETED',
      }
    );
  } else if (status === 'CANCELLED') {
    // Revert dog to available
    await prisma.dog.update({
      where: { id: reservation.dogId },
      data: { status: 'AVAILABLE' },
    });

    await sendReservationNotification(
      reservation.customer.email || '',
      'cancelled',
      {
        dogName: reservation.dog.name,
        kennelName: reservation.kennel.name,
        status: 'CANCELLED',
      }
    );
  }

  res.json({ reservation: updatedReservation });
});

// Cancel reservation (customer)
export const cancelReservation = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      kennel: true,
      dog: { select: { name: true } },
      customer: { select: { email: true } },
    },
  });

  if (!reservation) {
    return res.status(404).json({ error: 'Reservation not found' });
  }

  // Customers can only cancel their own pending reservations
  if (user.role === 'CUSTOMER') {
    const customer = await prisma.customer.findFirst({
      where: { userId: user.id },
    });
    if (reservation.customerId !== customer?.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (reservation.status !== 'PENDING') {
      return res.status(400).json({ error: 'Can only cancel pending reservations' });
    }
  }

  const updatedReservation = await prisma.reservation.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });

  // Revert dog status
  await prisma.dog.update({
    where: { id: reservation.dogId },
    data: { status: 'AVAILABLE' },
  });

  await sendReservationNotification(
    reservation.kennel.email || '',
    'cancelled',
    {
      dogName: reservation.dog.name,
      kennelName: reservation.kennel.name,
      status: 'CANCELLED',
    }
  );

  res.json({ reservation: updatedReservation });
});

// Delete reservation
export const deleteReservation = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { kennel: true },
  });

  if (!reservation) {
    return res.status(404).json({ error: 'Reservation not found' });
  }

  if (user.role === 'BREEDER' && reservation.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // If deleting an active reservation, revert dog status
  if (reservation.status === 'PENDING' || reservation.status === 'CONFIRMED') {
    await prisma.dog.update({
      where: { id: reservation.dogId },
      data: { status: 'AVAILABLE' },
    });
  }

  await prisma.reservation.delete({ where: { id } });

  res.json({ message: 'Reservation deleted' });
});
