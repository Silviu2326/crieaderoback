import { Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

// Get assigned kennels for vet
export const getMyKennels = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;

  if (user.role !== 'VETERINARIAN') {
    return res.status(403).json({ error: 'Only veterinarians can access this' });
  }

  const vet = await prisma.veterinarian.findUnique({
    where: { userId: user.id },
    include: {
      kennels: {
        include: {
          kennel: {
            include: {
              breeder: {
                select: { firstName: true, lastName: true, email: true },
              },
              _count: {
                select: { dogs: true },
              },
            },
          },
        },
      },
    },
  });

  if (!vet) {
    return res.json({ kennels: [] });
  }

  res.json({ kennels: vet.kennels.map(k => k.kennel) });
});

// Get dogs for assigned kennel (vet view)
export const getKennelDogs = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId } = req.params;
  const user = req.user!;

  if (user.role !== 'VETERINARIAN') {
    return res.status(403).json({ error: 'Only veterinarians can access this' });
  }

  const vet = await prisma.veterinarian.findUnique({
    where: { userId: user.id },
  });

  if (!vet) {
    return res.status(403).json({ error: 'Veterinarian profile not found' });
  }

  // Check assignment
  const assignment = await prisma.kennelVet.findUnique({
    where: {
      kennelId_vetId: {
        kennelId,
        vetId: vet.id,
      },
    },
  });

  if (!assignment) {
    return res.status(403).json({ error: 'Not assigned to this kennel' });
  }

  const dogs = await prisma.dog.findMany({
    where: { kennelId },
    include: {
      breed: { select: { name: true } },
      photos: { where: { isMain: true }, take: 1 },
      _count: {
        select: { medicalRecords: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  res.json({ dogs });
});

// Get vet profile
export const getMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;

  if (user.role !== 'VETERINARIAN') {
    return res.status(403).json({ error: 'Only veterinarians can access this' });
  }

  const vet = await prisma.veterinarian.findUnique({
    where: { userId: user.id },
    include: {
      kennels: {
        include: {
          kennel: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  if (!vet) {
    return res.status(404).json({ error: 'Veterinarian profile not found' });
  }

  res.json({ veterinarian: vet });
});

// Update vet profile
export const updateMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const { license, specialization } = req.body;

  if (user.role !== 'VETERINARIAN') {
    return res.status(403).json({ error: 'Only veterinarians can access this' });
  }

  const vet = await prisma.veterinarian.update({
    where: { userId: user.id },
    data: {
      license,
      specialization,
    },
  });

  res.json({ veterinarian: vet });
});

// Get upcoming vaccines/appointments for vet
export const getUpcomingVaccines = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;

  if (user.role !== 'VETERINARIAN') {
    return res.status(403).json({ error: 'Only veterinarians can access this' });
  }

  const vet = await prisma.veterinarian.findUnique({
    where: { userId: user.id },
  });

  if (!vet) {
    return res.status(403).json({ error: 'Veterinarian profile not found' });
  }

  const assignedKennelIds = await prisma.kennelVet.findMany({
    where: { vetId: vet.id },
    select: { kennelId: true },
  });

  const kennelIds = assignedKennelIds.map(k => k.kennelId);

  const upcoming = await prisma.medicalRecord.findMany({
    where: {
      dog: { kennelId: { in: kennelIds } },
      nextDate: {
        gte: new Date(),
        lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Next 30 days
      },
    },
    include: {
      dog: {
        select: {
          id: true,
          name: true,
          kennel: { select: { name: true } },
        },
      },
    },
    orderBy: { nextDate: 'asc' },
    take: 50,
  });

  res.json({ upcomingVaccines: upcoming });
});
