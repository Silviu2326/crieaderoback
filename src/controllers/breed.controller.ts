import { Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

// List all breeds
export const listBreeds = asyncHandler(async (req: Request, res: Response) => {
  const { search, group } = req.query;

  const where: any = { isActive: true };

  if (search) {
    where.name = { contains: search as string, mode: 'insensitive' };
  }
  if (group) {
    where.group = group as string;
  }

  const breeds = await prisma.breed.findMany({
    where,
    orderBy: { name: 'asc' },
  });

  res.json({ breeds });
});

// Get breed by ID
export const getBreed = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const breed = await prisma.breed.findUnique({
    where: { id },
    include: {
      _count: {
        select: { dogs: true },
      },
    },
  });

  if (!breed) {
    return res.status(404).json({ error: 'Breed not found' });
  }

  res.json({ breed });
});

// Create breed (Manager only)
export const createBreed = asyncHandler(async (req: Request, res: Response) => {
  const { name, group, description, origin } = req.body;

  const existing = await prisma.breed.findUnique({
    where: { name },
  });

  if (existing) {
    return res.status(409).json({ error: 'Breed with this name already exists' });
  }

  const breed = await prisma.breed.create({
    data: {
      name,
      group,
      description,
      origin,
    },
  });

  res.status(201).json({ breed });
});

// Update breed (Manager only)
export const updateBreed = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, group, description, origin, isActive } = req.body;

  const breed = await prisma.breed.update({
    where: { id },
    data: {
      name,
      group,
      description,
      origin,
      isActive,
    },
  });

  res.json({ breed });
});

// Toggle breed status
export const toggleBreedStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const breed = await prisma.breed.findUnique({
    where: { id },
  });

  if (!breed) {
    return res.status(404).json({ error: 'Breed not found' });
  }

  const updatedBreed = await prisma.breed.update({
    where: { id },
    data: { isActive: !breed.isActive },
  });

  res.json({
    message: `Breed ${updatedBreed.isActive ? 'activated' : 'deactivated'}`,
    breed: updatedBreed,
  });
});

// Get breed groups
export const getBreedGroups = asyncHandler(async (req: Request, res: Response) => {
  const groups = await prisma.breed.groupBy({
    by: ['group'],
    where: { isActive: true },
    _count: { group: true },
  });

  res.json({ groups: groups.map(g => ({ name: g.group, count: g._count.group })) });
});
