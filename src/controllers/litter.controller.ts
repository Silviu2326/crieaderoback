import { Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

// List litters
export const listLitters = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, search } = req.query;
  const user = req.user!;

  const where: any = {};

  if (kennelId) where.kennelId = kennelId as string;

  // Access control
  if (user.role === 'BREEDER') {
    const myKennels = await prisma.kennel.findMany({
      where: { breederId: user.id },
      select: { id: true },
    });
    const myKennelIds = myKennels.map(k => k.id);

    if (kennelId && !myKennelIds.includes(kennelId as string)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!kennelId) {
      where.kennelId = { in: myKennelIds };
    }
  } else if (user.role === 'VETERINARIAN') {
    const vet = await prisma.veterinarian.findUnique({
      where: { userId: user.id },
      include: { kennels: { select: { kennelId: true } } },
    });

    const assignedKennelIds = vet?.kennels.map(k => k.kennelId) || [];

    if (kennelId && !assignedKennelIds.includes(kennelId as string)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!kennelId) {
      where.kennelId = { in: assignedKennelIds };
    }
  }

  const litters = await prisma.litter.findMany({
    where,
    include: {
      kennel: {
        select: { id: true, name: true },
      },
      father: {
        select: { id: true, name: true, photos: { where: { isMain: true }, take: 1 } },
      },
      mother: {
        select: { id: true, name: true, photos: { where: { isMain: true }, take: 1 } },
      },
      puppies: {
        include: {
          dog: {
            select: { id: true, status: true },
          },
        },
      },
      _count: {
        select: { puppies: true },
      },
    },
    orderBy: { birthDate: 'desc' },
  });

  res.json({ litters });
});

// Get single litter
export const getLitter = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const litter = await prisma.litter.findUnique({
    where: { id },
    include: {
      kennel: {
        select: { id: true, name: true },
      },
      father: {
        include: {
          breed: { select: { name: true } },
          photos: { where: { isMain: true }, take: 1 },
        },
      },
      mother: {
        include: {
          breed: { select: { name: true } },
          photos: { where: { isMain: true }, take: 1 },
        },
      },
      puppies: {
        include: {
          dog: {
            select: {
              id: true,
              name: true,
              status: true,
              photos: { where: { isMain: true }, take: 1 },
            },
          },
        },
        orderBy: { name: 'asc' },
      },
    },
  });

  if (!litter) {
    return res.status(404).json({ error: 'Litter not found' });
  }

  // Access control
  if (user.role === 'BREEDER') {
    const kennel = await prisma.kennel.findUnique({
      where: { id: litter.kennelId },
    });
    if (kennel?.breederId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  if (user.role === 'VETERINARIAN') {
    const vet = await prisma.veterinarian.findUnique({
      where: { userId: user.id },
    });
    const isAssigned = await prisma.kennelVet.findUnique({
      where: {
        kennelId_vetId: {
          kennelId: litter.kennelId,
          vetId: vet?.id || '',
        },
      },
    });
    if (!isAssigned) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  res.json({ litter });
});

// Create litter
export const createLitter = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const { birthDate, fatherId, motherId, puppyCount, deadPuppies, notes, kennelId, puppies } = req.body;

  // Check access
  if (user.role === 'BREEDER') {
    const kennel = await prisma.kennel.findUnique({
      where: { id: kennelId },
    });
    if (!kennel || kennel.breederId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  // Validate parents
  if (fatherId) {
    const father = await prisma.dog.findUnique({
      where: { id: fatherId },
    });
    if (!father || father.gender !== 'MALE') {
      return res.status(400).json({ error: 'Invalid father' });
    }
  }

  if (motherId) {
    const mother = await prisma.dog.findUnique({
      where: { id: motherId },
    });
    if (!mother || mother.gender !== 'FEMALE') {
      return res.status(400).json({ error: 'Invalid mother' });
    }
  }

  const litter = await prisma.litter.create({
    data: {
      birthDate: new Date(birthDate),
      fatherId,
      motherId,
      puppyCount: puppyCount || 0,
      deadPuppies: deadPuppies || 0,
      notes,
      kennelId,
    },
    include: {
      father: { select: { name: true } },
      mother: { select: { name: true } },
    },
  });

  // Create puppies if provided
  if (puppies?.length) {
    await prisma.litterPuppy.createMany({
      data: puppies.map((puppy: any) => ({
        litterId: litter.id,
        name: puppy.name,
        gender: puppy.gender,
        color: puppy.color,
      })),
    });
  }

  const createdLitter = await prisma.litter.findUnique({
    where: { id: litter.id },
    include: {
      kennel: { select: { id: true, name: true } },
      father: { select: { id: true, name: true, photos: { where: { isMain: true }, take: 1 } } },
      mother: { select: { id: true, name: true, photos: { where: { isMain: true }, take: 1 } } },
      puppies: true,
    },
  });

  res.status(201).json({ litter: createdLitter });
});

// Update litter
export const updateLitter = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;
  const { birthDate, fatherId, motherId, puppyCount, deadPuppies, notes } = req.body;

  const litter = await prisma.litter.findUnique({
    where: { id },
    include: { kennel: true },
  });

  if (!litter) {
    return res.status(404).json({ error: 'Litter not found' });
  }

  if (user.role === 'BREEDER' && litter.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const updatedLitter = await prisma.litter.update({
    where: { id },
    data: {
      birthDate: birthDate ? new Date(birthDate) : undefined,
      fatherId,
      motherId,
      puppyCount,
      deadPuppies,
      notes,
    },
    include: {
      father: { select: { id: true, name: true } },
      mother: { select: { id: true, name: true } },
      puppies: true,
    },
  });

  res.json({ litter: updatedLitter });
});

// Delete litter
export const deleteLitter = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const litter = await prisma.litter.findUnique({
    where: { id },
    include: { kennel: true },
  });

  if (!litter) {
    return res.status(404).json({ error: 'Litter not found' });
  }

  if (user.role === 'BREEDER' && litter.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.litter.delete({ where: { id } });

  res.json({ message: 'Litter deleted' });
});

// Add puppy to litter
export const addPuppy = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;
  const { name, gender, color, microchip, status } = req.body;

  const litter = await prisma.litter.findUnique({
    where: { id },
    include: { kennel: true },
  });

  if (!litter) {
    return res.status(404).json({ error: 'Litter not found' });
  }

  if (user.role === 'BREEDER' && litter.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const puppy = await prisma.litterPuppy.create({
    data: {
      litterId: id,
      name,
      gender,
      color,
      microchip,
      status: status || 'AVAILABLE',
    },
  });

  res.status(201).json({ puppy });
});

// Promote puppy to full dog
export const promotePuppy = asyncHandler(async (req: Request, res: Response) => {
  const { id, puppyId } = req.params;
  const user = req.user!;
  const { name, breedId } = req.body;

  const litter = await prisma.litter.findUnique({
    where: { id },
    include: { kennel: true, father: true, mother: true },
  });

  if (!litter) {
    return res.status(404).json({ error: 'Litter not found' });
  }

  if (user.role === 'BREEDER' && litter.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const puppy = await prisma.litterPuppy.findUnique({
    where: { id: puppyId },
  });

  if (!puppy || puppy.litterId !== id) {
    return res.status(404).json({ error: 'Puppy not found in this litter' });
  }

  // Create the dog
  const dog = await prisma.dog.create({
    data: {
      name: name || puppy.name || `Puppy ${puppyId.slice(-4)}`,
      breedId: breedId || litter.mother?.breedId,
      gender: puppy.gender || 'MALE',
      birthDate: litter.birthDate,
      color: puppy.color,
      microchip: puppy.microchip,
      status: puppy.status || 'AVAILABLE',
      visibility: 'PRIVATE',
      kennelId: litter.kennelId,
      fatherId: litter.fatherId,
      motherId: litter.motherId,
    },
  });

  // Link puppy to dog
  await prisma.litterPuppy.update({
    where: { id: puppyId },
    data: { dogId: dog.id },
  });

  res.json({ message: 'Puppy promoted to dog', dog });
});

// Update puppy
export const updatePuppy = asyncHandler(async (req: Request, res: Response) => {
  const { id, puppyId } = req.params;
  const user = req.user!;
  const updateData = req.body;

  const litter = await prisma.litter.findUnique({
    where: { id },
    include: { kennel: true },
  });

  if (!litter) {
    return res.status(404).json({ error: 'Litter not found' });
  }

  if (user.role === 'BREEDER' && litter.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const puppy = await prisma.litterPuppy.update({
    where: { id: puppyId },
    data: updateData,
  });

  res.json({ puppy });
});

// Delete puppy
export const deletePuppy = asyncHandler(async (req: Request, res: Response) => {
  const { id, puppyId } = req.params;
  const user = req.user!;

  const litter = await prisma.litter.findUnique({
    where: { id },
    include: { kennel: true },
  });

  if (!litter) {
    return res.status(404).json({ error: 'Litter not found' });
  }

  if (user.role === 'BREEDER' && litter.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.litterPuppy.delete({
    where: { id: puppyId },
  });

  res.json({ message: 'Puppy removed' });
});
