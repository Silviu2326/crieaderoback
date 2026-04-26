import { Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

export const listClientReports = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, dogId, customerId, status } = req.query;
  const user = req.user!;

  const where: any = {};

  if (dogId) where.dogId = dogId as string;
  if (customerId) where.customerId = customerId as string;
  if (status) where.status = status as string;

  let kennelIds: string[] = [];

  if (kennelId) {
    kennelIds = [kennelId as string];
  }

  if (user.role === 'BREEDER') {
    const effectiveKennelId = (kennelId as string) || user.kennelId!;
    if (effectiveKennelId !== user.kennelId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    kennelIds = [effectiveKennelId];
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

  where.kennelId = { in: kennelIds };

  const reports = await prisma.clientReport.findMany({
    where,
    include: {
      dog: { select: { id: true, name: true, breed: { select: { name: true } }, photos: { where: { isMain: true }, take: 1 } } },
      customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      kennel: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ reports });
});

export const getClientReport = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const report = await prisma.clientReport.findUnique({
    where: { id },
    include: {
      dog: {
        include: {
          breed: { select: { id: true, name: true } },
          photos: { where: { isMain: true }, take: 1 },
          dogNutritions: {
            where: { isActive: true },
            include: {
              plan: true,
              recipe: { include: { ingredients: true } },
            },
          },
          nutritionLogs: { orderBy: { date: 'desc' }, take: 30 },
          supplements: { where: { endDate: null } },
          foodIntolerances: { where: { isActive: true } },
          father: { select: { id: true, name: true } },
          mother: { select: { id: true, name: true } },
        },
      },
      customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, address: true } },
      kennel: { select: { id: true, name: true, logoUrl: true, address: true, city: true, phone: true, email: true } },
    },
  });

  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }

  if (user.role === 'BREEDER') {
    if (user.kennelId !== report.kennelId) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  res.json({ report });
});

export const generateReport = asyncHandler(async (req: Request, res: Response) => {
  const { dogId, customerId, kennelId, title, notes, recommendations } = req.body;
  const user = req.user!;

  if (!dogId || !kennelId) {
    return res.status(400).json({ error: 'Missing required fields: dogId, kennelId' });
  }

  const dog = await prisma.dog.findUnique({
    where: { id: dogId },
    include: {
      kennel: { select: { breederId: true } },
      dogNutritions: {
        where: { isActive: true },
        include: { plan: true, recipe: true },
      },
      supplements: { where: { endDate: null } },
      foodIntolerances: { where: { isActive: true } },
    },
  });

  if (!dog) {
    return res.status(404).json({ error: 'Dog not found' });
  }

  if (user.role === 'BREEDER' && dog.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const reportTitle = title || `Informe de entrega - ${dog.name}`;

  let autoRecommendations = recommendations || '';
  if (!autoRecommendations) {
    const parts: string[] = [];

    if (dog.dogNutritions.length > 0) {
      const diet = dog.dogNutritions[0];
      parts.push(`Alimentación: Continuar con dieta ${diet.plan.dietType}${diet.recipe ? ` - receta "${diet.recipe.name}"` : ''}. Ración recomendada: ${diet.plan.dailyGramsPerKg}g por kg de peso corporal.`);
    }

    if (dog.supplements.length > 0) {
      parts.push(`Suplementación: ${dog.supplements.map((s) => `${s.name} (${s.dosage}, ${s.frequency})`).join(', ')}.`);
    }

    if (dog.foodIntolerances.length > 0) {
      parts.push(`Precauciones alimentarias: Evitar ${dog.foodIntolerances.map((i) => i.foodName).join(', ')}.`);
    }

    autoRecommendations = parts.join('\n\n');
  }

  const report = await prisma.clientReport.create({
    data: {
      title: reportTitle,
      kennelId,
      dogId,
      customerId: customerId || null,
      notes: notes || null,
      recommendations: autoRecommendations,
    },
    include: {
      dog: { select: { id: true, name: true } },
      customer: { select: { id: true, firstName: true, lastName: true } },
      kennel: { select: { id: true, name: true } },
    },
  });

  res.status(201).json({ report });
});

export const updateReport = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, notes, recommendations, customerId } = req.body;
  const user = req.user!;

  const existing = await prisma.clientReport.findUnique({
    where: { id },
    include: { kennel: { select: { breederId: true } } },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Report not found' });
  }

  if (existing.status === 'FINALIZED') {
    return res.status(400).json({ error: 'Cannot edit a finalized report' });
  }

  if (user.role === 'BREEDER' && existing.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const report = await prisma.clientReport.update({
    where: { id },
    data: {
      title,
      notes,
      recommendations,
      customerId: customerId || null,
    },
    include: {
      dog: { select: { id: true, name: true } },
      customer: { select: { id: true, firstName: true, lastName: true } },
      kennel: { select: { id: true, name: true } },
    },
  });

  res.json({ report });
});

export const finalizeReport = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const existing = await prisma.clientReport.findUnique({
    where: { id },
    include: { kennel: { select: { breederId: true } } },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Report not found' });
  }

  if (user.role === 'BREEDER' && existing.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const report = await prisma.clientReport.update({
    where: { id },
    data: { status: 'FINALIZED' },
    include: {
      dog: { select: { id: true, name: true } },
      customer: { select: { id: true, firstName: true, lastName: true } },
      kennel: { select: { id: true, name: true } },
    },
  });

  res.json({ report });
});

export const deleteReport = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const existing = await prisma.clientReport.findUnique({
    where: { id },
    include: { kennel: { select: { breederId: true } } },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Report not found' });
  }

  if (existing.status === 'FINALIZED') {
    return res.status(400).json({ error: 'Cannot delete a finalized report' });
  }

  if (user.role === 'BREEDER' && existing.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.clientReport.delete({ where: { id } });

  res.json({ message: 'Report deleted successfully' });
});
