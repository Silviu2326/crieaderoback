import { Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
import { startOfMonth, endOfMonth, format, parseISO } from 'date-fns';

export const getFeedingCosts = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, dateFrom, dateTo, dogId } = req.query;
  const user = req.user!;

  if (!kennelId) {
    return res.status(400).json({ error: 'Missing required field: kennelId' });
  }

  if (user.role === 'BREEDER') {
    if (user.kennelId !== kennelId as string) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  const from = dateFrom ? parseISO(dateFrom as string) : startOfMonth(new Date());
  const to = dateTo ? parseISO(dateTo as string) : endOfMonth(new Date());

  const dogsWhere: any = { kennelId: kennelId as string };
  if (dogId) dogsWhere.id = dogId as string;

  const dogs = await prisma.dog.findMany({
    where: dogsWhere,
    include: {
      photos: { where: { isMain: true }, take: 1 },
      dogNutritions: {
        where: { isActive: true },
        include: {
          plan: true,
          recipe: { include: { ingredients: true } },
        },
      },
      breed: { select: { id: true, name: true } },
    },
  });

  const dogIds = dogs.map((d) => d.id);

  const logs = await prisma.nutritionLog.findMany({
    where: {
      dogId: { in: dogIds },
      date: { gte: from, lte: to },
    },
  });

  const results = [];
  for (const dog of dogs) {
    const dogLogs = logs.filter((l) => l.dogId === dog.id);
    const totalGramsServed = dogLogs.reduce((sum, l) => sum + l.gramsServed, 0);
    const totalGramsConsumed = dogLogs.reduce((sum, l) => sum + (l.gramsServed - l.gramsLeftovers), 0);

    let totalCost = 0;
    let costSource = 'unknown';

    const activeDiet = dog.dogNutritions[0];

    if (activeDiet?.recipe) {
      const recipe = activeDiet.recipe;
      const recipeTotalCost = recipe.ingredients.reduce((sum, ing) => {
        return sum + (ing.costPerUnit || 0) * ing.quantity;
      }, 0);
      const totalRecipeGrams = recipe.ingredients.reduce((sum, ing) => {
        if (ing.unit === 'g') return sum + ing.quantity;
        if (ing.unit === 'kg') return sum + ing.quantity * 1000;
        return sum;
      }, 0);

      if (totalRecipeGrams > 0) {
        const costPerGram = recipeTotalCost / totalRecipeGrams;
        totalCost = totalGramsConsumed * costPerGram;
        costSource = 'recipe';
      }
    } else if (activeDiet?.plan) {
      const plan = activeDiet.plan;
      const inventoryItem = await prisma.inventoryItem.findFirst({
        where: {
          kennelId: kennelId as string,
          category: 'FOOD',
          name: { contains: plan.name },
        },
      });

      if (inventoryItem?.cost) {
        const costPerGram = inventoryItem.cost / 1000;
        totalCost = totalGramsConsumed * costPerGram;
        costSource = 'inventory';
      }
    }

    const daysWithLogs = new Set(dogLogs.map((l) => format(l.date, 'yyyy-MM-dd'))).size;
    const costPerDay = daysWithLogs > 0 ? totalCost / daysWithLogs : 0;
    const costPerKgWeight = dog.dogNutritions[0]?.currentWeightKg
      ? totalCost / dog.dogNutritions[0].currentWeightKg
      : 0;

    results.push({
      dogId: dog.id,
      dogName: dog.name,
      dogPhoto: dog.photos[0]?.url,
      breed: dog.breed?.name,
      weightKg: activeDiet?.currentWeightKg || null,
      totalGramsServed,
      totalGramsConsumed,
      totalCost,
      costPerDay,
      costPerKgWeight,
      daysWithLogs,
      costSource,
      planName: activeDiet?.plan?.name || null,
      recipeName: activeDiet?.recipe?.name || null,
    });
  }

  res.json({ costs: results });
});

export const getFeedingCostSummary = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, dateFrom, dateTo } = req.query;
  const user = req.user!;

  if (!kennelId) {
    return res.status(400).json({ error: 'Missing required field: kennelId' });
  }

  if (user.role === 'BREEDER') {
    if (user.kennelId !== kennelId as string) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  const from = dateFrom ? parseISO(dateFrom as string) : startOfMonth(new Date());
  const to = dateTo ? parseISO(dateTo as string) : endOfMonth(new Date());

  const dogs = await prisma.dog.findMany({
    where: { kennelId: kennelId as string },
    include: {
      dogNutritions: {
        where: { isActive: true },
        include: { recipe: { include: { ingredients: true } } },
      },
    },
  });

  const dogIds = dogs.map((d) => d.id);

  const logs = await prisma.nutritionLog.findMany({
    where: {
      dogId: { in: dogIds },
      date: { gte: from, lte: to },
    },
  });

  let totalCost = 0;
  let totalGramsConsumed = 0;
  let dogsWithCost = 0;
  let mostExpensiveDog = { name: '', cost: 0 };

  for (const dog of dogs) {
    const dogLogs = logs.filter((l) => l.dogId === dog.id);
    const gramsConsumed = dogLogs.reduce((sum, l) => sum + (l.gramsServed - l.gramsLeftovers), 0);

    let dogCost = 0;
    const activeDiet = dog.dogNutritions[0];

    if (activeDiet?.recipe) {
      const recipe = activeDiet.recipe;
      const recipeTotalCost = recipe.ingredients.reduce((sum, ing) => {
        return sum + (ing.costPerUnit || 0) * ing.quantity;
      }, 0);
      const totalRecipeGrams = recipe.ingredients.reduce((sum, ing) => {
        if (ing.unit === 'g') return sum + ing.quantity;
        if (ing.unit === 'kg') return sum + ing.quantity * 1000;
        return sum;
      }, 0);

      if (totalRecipeGrams > 0) {
        dogCost = gramsConsumed * (recipeTotalCost / totalRecipeGrams);
      }
    }

    totalCost += dogCost;
    totalGramsConsumed += gramsConsumed;
    if (dogCost > 0) dogsWithCost++;
    if (dogCost > mostExpensiveDog.cost) {
      mostExpensiveDog = { name: dog.name, cost: dogCost };
    }
  }

  const daysInPeriod = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
  const avgCostPerDog = dogsWithCost > 0 ? totalCost / dogsWithCost : 0;
  const avgCostPerDay = totalCost / daysInPeriod;

  res.json({
    totalCost,
    totalGramsConsumed,
    dogsCount: dogs.length,
    dogsWithCost,
    avgCostPerDog,
    avgCostPerDay,
    mostExpensiveDog,
    period: { from, to },
  });
});
