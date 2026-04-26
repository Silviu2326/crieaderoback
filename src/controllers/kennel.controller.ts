import { Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
import slugify from '../utils/slugify';

// List all kennels (Manager sees all, Breeder sees their own)
export const listKennels = asyncHandler(async (req: Request, res: Response) => {
  const { search, status } = req.query;
  const user = req.user!;

  const where: any = {};

  if (status) where.status = status;
  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { city: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  // Breeders only see their own kennels
  if (user.role === 'BREEDER') {
    where.breederId = user.id;
  }

  // Vets see only assigned kennels
  if (user.role === 'VETERINARIAN') {
    const vet = await prisma.veterinarian.findUnique({
      where: { userId: user.id },
      include: { kennels: { select: { kennelId: true } } },
    });

    if (!vet) {
      return res.json({ kennels: [] });
    }

    where.id = { in: vet.kennels.map((k) => k.kennelId) };
  }

  const kennels = await prisma.kennel.findMany({
    where,
    include: {
      breeder: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      _count: {
        select: {
          dogs: true,
          customers: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ kennels });
});

// Get single kennel
export const getKennel = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const kennel = await prisma.kennel.findUnique({
    where: { id },
    include: {
      breeder: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      _count: {
        select: {
          dogs: true,
          customers: true,
          litters: true,
          reservations: true,
        },
      },
    },
  });

  if (!kennel) {
    return res.status(404).json({ error: 'Kennel not found' });
  }

  // Check access
  if (user.role === 'BREEDER' && kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (user.role === 'VETERINARIAN') {
    const vet = await prisma.veterinarian.findUnique({
      where: { userId: user.id },
    });
    const isAssigned = await prisma.kennelVet.findUnique({
      where: {
        kennelId_vetId: {
          kennelId: id,
          vetId: vet?.id || '',
        },
      },
    });
    if (!isAssigned) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  res.json({ kennel });
});

// Create kennel (Manager only)
export const createKennel = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, address, city, country, phone, email, website, breederId, logoUrl } = req.body;

  // Generate unique slug
  let slug = slugify(name);
  let counter = 1;
  let existingSlug = await prisma.kennel.findUnique({ where: { slug } });
  while (existingSlug) {
    slug = `${slugify(name)}-${counter}`;
    existingSlug = await prisma.kennel.findUnique({ where: { slug } });
    counter++;
  }

  const kennel = await prisma.kennel.create({
    data: {
      name,
      slug,
      description,
      address,
      city,
      country,
      phone,
      email,
      website,
      logoUrl,
      breederId,
      status: 'ACTIVE',
    },
    include: {
      breeder: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  res.status(201).json({ kennel });
});

// Update kennel
export const updateKennel = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;
  const { name, description, address, city, country, phone, email, website, logoUrl, isPublic, status } = req.body;

  const kennel = await prisma.kennel.findUnique({
    where: { id },
  });

  if (!kennel) {
    return res.status(404).json({ error: 'Kennel not found' });
  }

  // Check permissions
  if (user.role === 'BREEDER' && kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Breeders can't change status
  const canChangeStatus = user.role === 'MANAGER';

  const updateData: any = {
    description,
    address,
    city,
    country,
    phone,
    email,
    website,
    logoUrl,
    isPublic,
  };

  // Only Manager can change name (affects slug) and status
  if (user.role === 'MANAGER') {
    if (name && name !== kennel.name) {
      updateData.name = name;
      let slug = slugify(name);
      let counter = 1;
      let existingSlug = await prisma.kennel.findFirst({
        where: { slug, id: { not: id } },
      });
      while (existingSlug) {
        slug = `${slugify(name)}-${counter}`;
        existingSlug = await prisma.kennel.findFirst({
          where: { slug, id: { not: id } },
        });
        counter++;
      }
      updateData.slug = slug;
    }
    if (status) updateData.status = status;
  }

  const updatedKennel = await prisma.kennel.update({
    where: { id },
    data: updateData,
    include: {
      breeder: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  res.json({ kennel: updatedKennel });
});

// Toggle kennel status (Manager only)
export const toggleKennelStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const kennel = await prisma.kennel.findUnique({
    where: { id },
  });

  if (!kennel) {
    return res.status(404).json({ error: 'Kennel not found' });
  }

  const newStatus = kennel.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

  await prisma.kennel.update({
    where: { id },
    data: { status: newStatus },
  });

  res.json({ message: `Kennel ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}`, status: newStatus });
});

// Get kennel dashboard stats
export const getKennelStats = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const kennel = await prisma.kennel.findUnique({
    where: { id },
  });

  if (!kennel) {
    return res.status(404).json({ error: 'Kennel not found' });
  }

  // Check access
  if (user.role === 'BREEDER' && kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const [dogStats, customerStats, reservationStats, upcomingVaccines] = await Promise.all([
    // Dog statistics
    prisma.dog.groupBy({
      by: ['status'],
      where: { kennelId: id },
      _count: { status: true },
    }),
    // Customer statistics
    prisma.customer.groupBy({
      by: ['isArchived'],
      where: { kennelId: id },
      _count: { isArchived: true },
    }),
    // Reservation statistics
    prisma.reservation.groupBy({
      by: ['status'],
      where: { kennelId: id },
      _count: { status: true },
    }),
    // Upcoming vaccines (next 30 days)
    prisma.medicalRecord.count({
      where: {
        dog: { kennelId: id },
        nextDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  res.json({
    stats: {
      dogs: dogStats,
      customers: customerStats,
      reservations: reservationStats,
      upcomingVaccines,
    },
  });
});

// Get my kennel (single kennel for the authenticated user)
export const getMyKennel = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;

  if (!user.kennelId) {
    return res.status(404).json({ error: 'Kennel not found' });
  }

  const kennel = await prisma.kennel.findUnique({
    where: { id: user.kennelId },
    include: {
      breeder: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      _count: {
        select: {
          dogs: true,
          customers: true,
          litters: true,
          reservations: true,
        },
      },
    },
  });

  if (!kennel) {
    return res.status(404).json({ error: 'Kennel not found' });
  }

  res.json({ kennel });
});
