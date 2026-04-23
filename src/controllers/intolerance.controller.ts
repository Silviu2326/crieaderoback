import { Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

export const listIntolerances = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, dogId, search, severity, isActive } = req.query;
  const user = req.user!;

  const where: any = {};

  if (dogId) {
    where.dogId = dogId as string;
  }

  if (severity) where.severity = severity as string;
  if (isActive !== undefined) where.isActive = isActive === 'true';

  if (search) {
    where.OR = [
      { foodName: { contains: search as string, mode: 'insensitive' } },
      { symptoms: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  let kennelIds: string[] = [];

  if (kennelId) {
    kennelIds = [kennelId as string];
  }

  if (user.role === 'BREEDER') {
    const myKennels = await prisma.kennel.findMany({
      where: { breederId: user.id },
      select: { id: true },
    });
    const myKennelIds = myKennels.map((k) => k.id);

    if (kennelId && !myKennelIds.includes(kennelId as string)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    kennelIds = kennelId ? [kennelId as string] : myKennelIds;
  } else if (user.role === 'VETERINARIAN') {
    const vet = await prisma.veterinarian.findUnique({
      where: { userId: user.id },
      include: { kennels: { select: { kennelId: true } } },
    });
    const assignedKennelIds = vet?.kennels.map((k) => k.kennelId) || [];

    if (kennelId && !assignedKennelIds.includes(kennelId as string)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    kennelIds = kennelId ? [kennelId as string] : assignedKennelIds;
  } else if (user.role === 'MANAGER') {
    if (!kennelId) {
      const allKennels = await prisma.kennel.findMany({ select: { id: true } });
      kennelIds = allKennels.map((k) => k.id);
    }
  }

  const intolerances = await prisma.foodIntolerance.findMany({
    where: {
      ...where,
      dog: { kennelId: { in: kennelIds } },
    },
    include: {
      dog: { select: { id: true, name: true, photos: { where: { isMain: true }, take: 1 } } },
      _count: { select: { reactions: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ intolerances });
});

export const getIntolerance = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const intolerance = await prisma.foodIntolerance.findUnique({
    where: { id },
    include: {
      dog: { select: { id: true, name: true, kennelId: true, photos: { where: { isMain: true }, take: 1 } } },
      reactions: { orderBy: { date: 'desc' } },
    },
  });

  if (!intolerance) {
    return res.status(404).json({ error: 'Intolerance not found' });
  }

  if (user.role === 'BREEDER') {
    const myKennels = await prisma.kennel.findMany({
      where: { breederId: user.id },
      select: { id: true },
    });
    if (!myKennels.some((k) => k.id === intolerance.dog.kennelId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  res.json({ intolerance });
});

export const createIntolerance = asyncHandler(async (req: Request, res: Response) => {
  const { dogId, foodName, severity, symptoms, notes } = req.body;
  const user = req.user!;

  if (!dogId || !foodName || !severity) {
    return res.status(400).json({ error: 'Missing required fields: dogId, foodName, severity' });
  }

  const dog = await prisma.dog.findUnique({
    where: { id: dogId },
    include: { kennel: { select: { breederId: true } } },
  });

  if (!dog) {
    return res.status(404).json({ error: 'Dog not found' });
  }

  if (user.role === 'BREEDER' && dog.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const intolerance = await prisma.foodIntolerance.create({
    data: {
      dogId,
      foodName,
      severity,
      symptoms,
      notes,
    },
    include: {
      dog: { select: { id: true, name: true } },
    },
  });

  res.status(201).json({ intolerance });
});

export const updateIntolerance = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { foodName, severity, symptoms, notes, isActive } = req.body;
  const user = req.user!;

  const existing = await prisma.foodIntolerance.findUnique({
    where: { id },
    include: { dog: { select: { kennel: { select: { breederId: true } } } } },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Intolerance not found' });
  }

  if (user.role === 'BREEDER' && existing.dog.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const intolerance = await prisma.foodIntolerance.update({
    where: { id },
    data: {
      foodName,
      severity,
      symptoms,
      notes,
      isActive,
    },
    include: {
      dog: { select: { id: true, name: true } },
    },
  });

  res.json({ intolerance });
});

export const deleteIntolerance = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const existing = await prisma.foodIntolerance.findUnique({
    where: { id },
    include: { dog: { select: { kennel: { select: { breederId: true } } } } },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Intolerance not found' });
  }

  if (user.role === 'BREEDER' && existing.dog.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.foodIntolerance.delete({ where: { id } });

  res.json({ message: 'Intolerance deleted successfully' });
});

// Reactions
export const listReactions = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const intolerance = await prisma.foodIntolerance.findUnique({
    where: { id },
    include: { dog: { select: { kennelId: true } } },
  });

  if (!intolerance) {
    return res.status(404).json({ error: 'Intolerance not found' });
  }

  if (user.role === 'BREEDER') {
    const myKennels = await prisma.kennel.findMany({
      where: { breederId: user.id },
      select: { id: true },
    });
    if (!myKennels.some((k) => k.id === intolerance.dog.kennelId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  const reactions = await prisma.intoleranceReaction.findMany({
    where: { intoleranceId: id },
    orderBy: { date: 'desc' },
  });

  res.json({ reactions });
});

export const createReaction = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { date, symptoms, severity, notes } = req.body;
  const user = req.user!;

  const intolerance = await prisma.foodIntolerance.findUnique({
    where: { id },
    include: { dog: { select: { kennel: { select: { breederId: true } } } } },
  });

  if (!intolerance) {
    return res.status(404).json({ error: 'Intolerance not found' });
  }

  if (user.role === 'BREEDER' && intolerance.dog.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const reaction = await prisma.intoleranceReaction.create({
    data: {
      intoleranceId: id,
      date: date ? new Date(date) : new Date(),
      symptoms,
      severity,
      notes,
    },
  });

  res.status(201).json({ reaction });
});

export const updateReaction = asyncHandler(async (req: Request, res: Response) => {
  const { reactionId } = req.params;
  const { date, symptoms, severity, notes, resolvedAt } = req.body;
  const user = req.user!;

  const existing = await prisma.intoleranceReaction.findUnique({
    where: { id: reactionId },
    include: {
      intolerance: {
        include: { dog: { select: { kennel: { select: { breederId: true } } } } },
      },
    },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Reaction not found' });
  }

  if (user.role === 'BREEDER' && existing.intolerance.dog.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const reaction = await prisma.intoleranceReaction.update({
    where: { id: reactionId },
    data: {
      date: date ? new Date(date) : undefined,
      symptoms,
      severity,
      notes,
      resolvedAt: resolvedAt ? new Date(resolvedAt) : undefined,
    },
  });

  res.json({ reaction });
});

export const deleteReaction = asyncHandler(async (req: Request, res: Response) => {
  const { reactionId } = req.params;
  const user = req.user!;

  const existing = await prisma.intoleranceReaction.findUnique({
    where: { id: reactionId },
    include: {
      intolerance: {
        include: { dog: { select: { kennel: { select: { breederId: true } } } } },
      },
    },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Reaction not found' });
  }

  if (user.role === 'BREEDER' && existing.intolerance.dog.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.intoleranceReaction.delete({ where: { id: reactionId } });

  res.json({ message: 'Reaction deleted successfully' });
});

export const checkIntoleranceAlert = asyncHandler(async (req: Request, res: Response) => {
  const { dogId, foodName } = req.body;
  const user = req.user!;

  if (!dogId || !foodName) {
    return res.status(400).json({ error: 'Missing dogId or foodName' });
  }

  const dog = await prisma.dog.findUnique({
    where: { id: dogId },
    include: { kennel: { select: { breederId: true } } },
  });

  if (!dog) {
    return res.status(404).json({ error: 'Dog not found' });
  }

  if (user.role === 'BREEDER' && dog.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const intolerances = await prisma.foodIntolerance.findMany({
    where: {
      dogId,
      isActive: true,
      foodName: { contains: foodName },
    },
  });

  const hasAlert = intolerances.length > 0;

  res.json({
    hasAlert,
    intolerances: intolerances.map((i) => ({
      id: i.id,
      foodName: i.foodName,
      severity: i.severity,
      symptoms: i.symptoms,
    })),
  });
});
