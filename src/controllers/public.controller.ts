import { Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

// Public kennel page
export const getPublicKennel = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params;

  const kennel = await prisma.kennel.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      description: true,
      logoUrl: true,
      address: true,
      city: true,
      country: true,
      phone: true,
      email: true,
      website: true,
      status: true,
      isPublic: true,
    },
  });

  if (!kennel || kennel.status !== 'ACTIVE' || !kennel.isPublic) {
    return res.status(404).json({ error: 'Kennel not found' });
  }

  // Get public dogs
  const dogs = await prisma.dog.findMany({
    where: {
      kennelId: kennel.id,
      visibility: 'PUBLIC',
      status: { not: 'SOLD' },
    },
    include: {
      breed: { select: { name: true } },
      photos: { where: { isMain: true }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ kennel, dogs });
});

// Public dog detail
export const getPublicDog = asyncHandler(async (req: Request, res: Response) => {
  const { slug, dogId } = req.params;

  const kennel = await prisma.kennel.findUnique({
    where: { slug },
  });

  if (!kennel || kennel.status !== 'ACTIVE' || !kennel.isPublic) {
    return res.status(404).json({ error: 'Kennel not found' });
  }

  const dog = await prisma.dog.findFirst({
    where: {
      id: dogId,
      kennelId: kennel.id,
      visibility: 'PUBLIC',
    },
    include: {
      breed: true,
      photos: { orderBy: { order: 'asc' } },
      father: {
        select: {
          name: true,
          breed: { select: { name: true } },
        },
      },
      mother: {
        select: {
          name: true,
          breed: { select: { name: true } },
        },
      },
    },
  });

  if (!dog) {
    return res.status(404).json({ error: 'Dog not found' });
  }

  res.json({ dog });
});

// List all public kennels
export const listPublicKennels = asyncHandler(async (req: Request, res: Response) => {
  const { search } = req.query;

  const where: any = {
    status: 'ACTIVE',
    isPublic: true,
  };

  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { city: { contains: search as string, mode: 'insensitive' } },
      { description: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  const kennels = await prisma.kennel.findMany({
    where,
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      logoUrl: true,
      city: true,
      country: true,
      _count: {
        select: {
          dogs: {
            where: { visibility: 'PUBLIC', status: { not: 'SOLD' } },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  res.json({ kennels });
});
