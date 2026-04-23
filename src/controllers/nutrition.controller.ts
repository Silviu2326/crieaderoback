import { Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
import { differenceInMonths } from 'date-fns';

// ==================== PLANS ====================

export const listNutritionPlans = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, search, dietType, isActive } = req.query;
  const user = req.user!;

  const where: any = {};

  if (kennelId) where.kennelId = kennelId as string;
  if (dietType) where.dietType = dietType as string;
  if (isActive !== undefined) where.isActive = isActive === 'true';

  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { instructions: { contains: search as string, mode: 'insensitive' } },
    ];
  }

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

  const plans = await prisma.nutritionPlan.findMany({
    where,
    include: {
      targetBreed: { select: { id: true, name: true } },
      kennel: { select: { id: true, name: true } },
      _count: { select: { dogDiets: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ plans });
});

export const getNutritionPlan = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const plan = await prisma.nutritionPlan.findUnique({
    where: { id },
    include: {
      targetBreed: { select: { id: true, name: true } },
      kennel: { select: { id: true, name: true } },
      dogDiets: {
        include: {
          dog: { select: { id: true, name: true, photos: { where: { isMain: true }, take: 1 } } },
        },
      },
    },
  });

  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  // Access control
  if (user.role === 'BREEDER') {
    const kennel = await prisma.kennel.findUnique({ where: { id: plan.kennelId } });
    if (!kennel || kennel.breederId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
  } else if (user.role === 'VETERINARIAN') {
    const vet = await prisma.veterinarian.findUnique({ where: { userId: user.id } });
    const isAssigned = await prisma.kennelVet.findUnique({
      where: { kennelId_vetId: { kennelId: plan.kennelId, vetId: vet?.id || '' } },
    });
    if (!isAssigned) return res.status(403).json({ error: 'Access denied' });
  }

  res.json({ plan });
});

export const createNutritionPlan = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const {
    name,
    dietType,
    targetBreedId,
    minAgeMonths,
    maxAgeMonths,
    minWeightKg,
    maxWeightKg,
    activityLevel,
    dailyGramsPerKg,
    instructions,
    kennelId,
  } = req.body;

  // Check access
  if (user.role === 'BREEDER') {
    const kennel = await prisma.kennel.findUnique({ where: { id: kennelId } });
    if (!kennel || kennel.breederId !== user.id) {
      return res.status(403).json({ error: 'Access denied to this kennel' });
    }
  }

  const plan = await prisma.nutritionPlan.create({
    data: {
      name,
      dietType,
      targetBreedId,
      minAgeMonths,
      maxAgeMonths,
      minWeightKg,
      maxWeightKg,
      activityLevel,
      dailyGramsPerKg,
      instructions,
      kennelId,
    },
    include: { targetBreed: { select: { id: true, name: true } } },
  });

  res.status(201).json({ plan });
});

export const updateNutritionPlan = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;
  const updateData = req.body;

  const plan = await prisma.nutritionPlan.findUnique({
    where: { id },
    include: { kennel: true },
  });

  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  if (user.role === 'BREEDER' && plan.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (user.role === 'VETERINARIAN') {
    return res.status(403).json({ error: 'Veterinarians cannot modify nutrition plans' });
  }

  const data: any = {};
  if (updateData.name !== undefined) data.name = updateData.name;
  if (updateData.dietType !== undefined) data.dietType = updateData.dietType;
  if (updateData.targetBreedId !== undefined) data.targetBreedId = updateData.targetBreedId || null;
  if (updateData.minAgeMonths !== undefined) data.minAgeMonths = updateData.minAgeMonths;
  if (updateData.maxAgeMonths !== undefined) data.maxAgeMonths = updateData.maxAgeMonths;
  if (updateData.minWeightKg !== undefined) data.minWeightKg = updateData.minWeightKg;
  if (updateData.maxWeightKg !== undefined) data.maxWeightKg = updateData.maxWeightKg;
  if (updateData.activityLevel !== undefined) data.activityLevel = updateData.activityLevel;
  if (updateData.dailyGramsPerKg !== undefined) data.dailyGramsPerKg = updateData.dailyGramsPerKg;
  if (updateData.instructions !== undefined) data.instructions = updateData.instructions;
  if (updateData.isActive !== undefined) data.isActive = updateData.isActive;

  const updatedPlan = await prisma.nutritionPlan.update({
    where: { id },
    data,
    include: { targetBreed: { select: { id: true, name: true } } },
  });

  res.json({ plan: updatedPlan });
});

export const deleteNutritionPlan = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const plan = await prisma.nutritionPlan.findUnique({
    where: { id },
    include: { kennel: true },
  });

  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  if (user.role === 'BREEDER' && plan.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.nutritionPlan.delete({ where: { id } });

  res.json({ message: 'Plan deleted successfully' });
});

export const calculateRation = asyncHandler(async (req: Request, res: Response) => {
  const { weightKg, ageMonths, activityLevel, neutered } = req.body;

  if (typeof weightKg !== 'number' || typeof ageMonths !== 'number') {
    return res.status(400).json({ error: 'weightKg and ageMonths are required' });
  }

  // Base factor: grams per kg depending on life stage
  let baseFactor = 25; // adult maintenance
  if (ageMonths < 4) {
    baseFactor = 55; // puppy fast growth
  } else if (ageMonths < 8) {
    baseFactor = 40; // puppy slow growth
  } else if (ageMonths < 12) {
    baseFactor = 30; // adolescent
  } else if (ageMonths > 84) {
    baseFactor = 22; // senior
  }

  // Activity multiplier
  const activityMultipliers: Record<string, number> = {
    LOW: 0.9,
    MODERATE: 1.0,
    HIGH: 1.2,
    VERY_HIGH: 1.5,
  };
  const multiplier = activityMultipliers[activityLevel] || 1.0;

  // Neutered reduction
  const neuteredFactor = neutered ? 0.85 : 1.0;

  const dailyGrams = Math.round(weightKg * baseFactor * multiplier * neuteredFactor);
  const stage = getStageFromAge(ageMonths);

  res.json({ weightKg, ageMonths, activityLevel, dailyGrams, stage });
});

function getStageFromAge(ageMonths: number): string {
  if (ageMonths < 12) return 'PUPPY';
  if (ageMonths < 84) return 'ADULT';
  return 'SENIOR';
}

// ==================== DOG NUTRITIONS ====================

export const listDogNutritions = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, dogId, active } = req.query;
  const user = req.user!;

  const dogWhere: any = {};
  if (dogId) dogWhere.id = dogId as string;
  if (kennelId) dogWhere.kennelId = kennelId as string;

  const where: any = {};
  if (active !== undefined) where.isActive = active === 'true';

  // Access control via dog kennel
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
      dogWhere.kennelId = { in: myKennelIds };
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
      dogWhere.kennelId = { in: assignedKennelIds };
    }
  }

  if (Object.keys(dogWhere).length > 0) {
    where.dog = dogWhere;
  }

  const diets = await prisma.dogNutrition.findMany({
    where,
    include: {
      dog: { select: { id: true, name: true, birthDate: true, photos: { where: { isMain: true }, take: 1 } } },
      plan: { select: { id: true, name: true, dietType: true, dailyGramsPerKg: true, activityLevel: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ diets });
});

export const createDogNutrition = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const { dogId, planId, startDate, endDate, currentWeightKg, notes } = req.body;

  const dog = await prisma.dog.findUnique({ where: { id: dogId }, include: { kennel: true } });
  if (!dog) return res.status(404).json({ error: 'Dog not found' });

  if (user.role === 'BREEDER' && dog.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const plan = await prisma.nutritionPlan.findUnique({ where: { id: planId } });
  if (!plan) return res.status(404).json({ error: 'Plan not found' });

  const diet = await prisma.dogNutrition.create({
    data: {
      dogId,
      planId,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      currentWeightKg,
      notes,
    },
    include: {
      dog: { select: { id: true, name: true, photos: { where: { isMain: true }, take: 1 } } },
      plan: { select: { id: true, name: true, dietType: true } },
    },
  });

  res.status(201).json({ diet });
});

export const updateDogNutrition = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;
  const updateData = req.body;

  const diet = await prisma.dogNutrition.findUnique({
    where: { id },
    include: { dog: { include: { kennel: true } } },
  });

  if (!diet) return res.status(404).json({ error: 'Diet not found' });

  if (user.role === 'BREEDER' && diet.dog.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const data: any = {};
  if (updateData.planId !== undefined) data.planId = updateData.planId;
  if (updateData.startDate !== undefined) data.startDate = new Date(updateData.startDate);
  if (updateData.endDate !== undefined) data.endDate = updateData.endDate ? new Date(updateData.endDate) : null;
  if (updateData.currentWeightKg !== undefined) data.currentWeightKg = updateData.currentWeightKg;
  if (updateData.notes !== undefined) data.notes = updateData.notes;
  if (updateData.isActive !== undefined) data.isActive = updateData.isActive;

  const updated = await prisma.dogNutrition.update({
    where: { id },
    data,
    include: {
      dog: { select: { id: true, name: true, photos: { where: { isMain: true }, take: 1 } } },
      plan: { select: { id: true, name: true, dietType: true } },
    },
  });

  res.json({ diet: updated });
});

export const deleteDogNutrition = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const diet = await prisma.dogNutrition.findUnique({
    where: { id },
    include: { dog: { include: { kennel: true } } },
  });

  if (!diet) return res.status(404).json({ error: 'Diet not found' });

  if (user.role === 'BREEDER' && diet.dog.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.dogNutrition.delete({ where: { id } });

  res.json({ message: 'Diet deleted successfully' });
});

export const getNutritionStage = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const diet = await prisma.dogNutrition.findUnique({
    where: { id },
    include: { dog: { include: { kennel: true } } },
  });

  if (!diet) return res.status(404).json({ error: 'Diet not found' });

  if (user.role === 'BREEDER' && diet.dog.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const ageMonths = differenceInMonths(new Date(), new Date(diet.dog.birthDate));
  const stage = getStageFromAge(ageMonths);

  res.json({ stage, ageMonths });
});

// ==================== NUTRITION LOGS ====================

export const listNutritionLogs = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, dogId, planId, dateFrom, dateTo } = req.query;
  const user = req.user!;

  const dogWhere: any = {};
  if (dogId) dogWhere.id = dogId as string;
  if (kennelId) dogWhere.kennelId = kennelId as string;

  const where: any = {};
  if (planId) where.planId = planId as string;
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom as string);
    if (dateTo) where.date.lte = new Date(dateTo as string);
  }

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
      dogWhere.kennelId = { in: myKennelIds };
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
      dogWhere.kennelId = { in: assignedKennelIds };
    }
  }

  if (Object.keys(dogWhere).length > 0) {
    where.dog = dogWhere;
  }

  const logs = await prisma.nutritionLog.findMany({
    where,
    include: {
      dog: { select: { id: true, name: true, photos: { where: { isMain: true }, take: 1 } } },
      plan: { select: { id: true, name: true, dietType: true } },
    },
    orderBy: { date: 'desc' },
  });

  res.json({ logs });
});

export const createNutritionLog = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const { dogId, planId, date, gramsServed, gramsLeftovers, notes } = req.body;

  const dog = await prisma.dog.findUnique({ where: { id: dogId }, include: { kennel: true } });
  if (!dog) return res.status(404).json({ error: 'Dog not found' });

  if (user.role === 'BREEDER' && dog.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const log = await prisma.nutritionLog.create({
    data: {
      dogId,
      planId,
      date: date ? new Date(date) : new Date(),
      gramsServed,
      gramsLeftovers: gramsLeftovers || 0,
      notes,
    },
    include: {
      dog: { select: { id: true, name: true } },
      plan: { select: { id: true, name: true } },
    },
  });

  res.status(201).json({ log });
});

export const updateNutritionLog = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;
  const updateData = req.body;

  const log = await prisma.nutritionLog.findUnique({
    where: { id },
    include: { dog: { include: { kennel: true } } },
  });

  if (!log) return res.status(404).json({ error: 'Log not found' });

  if (user.role === 'BREEDER' && log.dog.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const data: any = {};
  if (updateData.date !== undefined) data.date = new Date(updateData.date);
  if (updateData.gramsServed !== undefined) data.gramsServed = updateData.gramsServed;
  if (updateData.gramsLeftovers !== undefined) data.gramsLeftovers = updateData.gramsLeftovers;
  if (updateData.notes !== undefined) data.notes = updateData.notes;
  if (updateData.planId !== undefined) data.planId = updateData.planId;

  const updated = await prisma.nutritionLog.update({
    where: { id },
    data,
    include: {
      dog: { select: { id: true, name: true } },
      plan: { select: { id: true, name: true } },
    },
  });

  res.json({ log: updated });
});

export const deleteNutritionLog = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const log = await prisma.nutritionLog.findUnique({
    where: { id },
    include: { dog: { include: { kennel: true } } },
  });

  if (!log) return res.status(404).json({ error: 'Log not found' });

  if (user.role === 'BREEDER' && log.dog.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.nutritionLog.delete({ where: { id } });

  res.json({ message: 'Log deleted successfully' });
});

// ==================== SUPPLEMENTS ====================

export const listSupplements = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, dogId, active } = req.query;
  const user = req.user!;

  const dogWhere: any = {};
  if (dogId) dogWhere.id = dogId as string;
  if (kennelId) dogWhere.kennelId = kennelId as string;

  const where: any = {};
  if (active !== undefined) {
    const now = new Date();
    if (active === 'true') {
      where.OR = [{ endDate: null }, { endDate: { gt: now } }];
    } else {
      where.endDate = { lte: now };
    }
  }

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
      dogWhere.kennelId = { in: myKennelIds };
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
      dogWhere.kennelId = { in: assignedKennelIds };
    }
  }

  if (Object.keys(dogWhere).length > 0) {
    where.dog = dogWhere;
  }

  const supplements = await prisma.supplement.findMany({
    where,
    include: {
      dog: { select: { id: true, name: true, photos: { where: { isMain: true }, take: 1 } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ supplements });
});

export const createSupplement = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const { dogId, name, dosage, frequency, startDate, endDate, notes } = req.body;

  const dog = await prisma.dog.findUnique({ where: { id: dogId }, include: { kennel: true } });
  if (!dog) return res.status(404).json({ error: 'Dog not found' });

  if (user.role === 'BREEDER' && dog.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const supplement = await prisma.supplement.create({
    data: {
      dogId,
      name,
      dosage,
      frequency,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      notes,
    },
    include: {
      dog: { select: { id: true, name: true } },
    },
  });

  res.status(201).json({ supplement });
});

export const updateSupplement = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;
  const updateData = req.body;

  const supplement = await prisma.supplement.findUnique({
    where: { id },
    include: { dog: { include: { kennel: true } } },
  });

  if (!supplement) return res.status(404).json({ error: 'Supplement not found' });

  if (user.role === 'BREEDER' && supplement.dog.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const data: any = {};
  if (updateData.name !== undefined) data.name = updateData.name;
  if (updateData.dosage !== undefined) data.dosage = updateData.dosage;
  if (updateData.frequency !== undefined) data.frequency = updateData.frequency;
  if (updateData.startDate !== undefined) data.startDate = new Date(updateData.startDate);
  if (updateData.endDate !== undefined) data.endDate = updateData.endDate ? new Date(updateData.endDate) : null;
  if (updateData.notes !== undefined) data.notes = updateData.notes;

  const updated = await prisma.supplement.update({
    where: { id },
    data,
    include: {
      dog: { select: { id: true, name: true } },
    },
  });

  res.json({ supplement: updated });
});

export const deleteSupplement = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const supplement = await prisma.supplement.findUnique({
    where: { id },
    include: { dog: { include: { kennel: true } } },
  });

  if (!supplement) return res.status(404).json({ error: 'Supplement not found' });

  if (user.role === 'BREEDER' && supplement.dog.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.supplement.delete({ where: { id } });

  res.json({ message: 'Supplement deleted successfully' });
});
