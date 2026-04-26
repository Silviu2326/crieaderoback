import { Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

export const listRecipes = asyncHandler(async (req: Request, res: Response) => {
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
    const effectiveKennelId = (kennelId as string) || user.kennelId;
    if (effectiveKennelId !== user.kennelId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!kennelId) {
      where.kennelId = user.kennelId;
    }
  } else if (user.role === 'VETERINARIAN') {
    const vet = await prisma.veterinarian.findUnique({
      where: { userId: user.id },
      include: { kennels: { select: { kennelId: true } } },
    });
    const assignedKennelIds = vet?.kennels.map((k) => k.kennelId) || [];

    if (kennelId && !assignedKennelIds.includes(kennelId as string)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!kennelId) {
      where.kennelId = { in: assignedKennelIds };
    }
  }

  const recipes = await prisma.recipe.findMany({
    where,
    include: {
      ingredients: true,
      kennel: { select: { id: true, name: true } },
      _count: { select: { dogDiets: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ recipes });
});

export const getRecipe = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: {
      ingredients: {
        include: {
          inventoryItem: { select: { id: true, name: true, cost: true, unit: true } },
        },
      },
      kennel: { select: { id: true, name: true } },
      dogDiets: {
        include: {
          dog: { select: { id: true, name: true, photos: { where: { isMain: true }, take: 1 } } },
        },
      },
    },
  });

  if (!recipe) {
    return res.status(404).json({ error: 'Recipe not found' });
  }

  if (user.role === 'BREEDER') {
    if (user.kennelId !== recipe.kennelId) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  res.json({ recipe });
});

export const createRecipe = asyncHandler(async (req: Request, res: Response) => {
  const { name, dietType, portions, instructions, notes, kennelId, ingredients } = req.body;
  const user = req.user!;

  if (!name || !kennelId) {
    return res.status(400).json({ error: 'Missing required fields: name, kennelId' });
  }

  if (user.role === 'BREEDER') {
    const resolvedKennelId = kennelId || user.kennelId;
    if (resolvedKennelId !== user.kennelId) {
      return res.status(403).json({ error: 'Access denied to this kennel' });
    }
  }

  const recipe = await prisma.recipe.create({
    data: {
      name,
      dietType: dietType || 'DRY',
      portions: portions || 1,
      instructions,
      notes,
      kennelId,
      ingredients: {
        create: (ingredients || []).map((ing: any) => ({
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          costPerUnit: ing.costPerUnit,
          notes: ing.notes,
          inventoryItemId: ing.inventoryItemId,
        })),
      },
    },
    include: {
      ingredients: true,
      kennel: { select: { id: true, name: true } },
    },
  });

  res.status(201).json({ recipe });
});

export const updateRecipe = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, dietType, portions, instructions, notes, isActive, ingredients } = req.body;
  const user = req.user!;

  const existing = await prisma.recipe.findUnique({
    where: { id },
    include: { kennel: { select: { breederId: true } } },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Recipe not found' });
  }

  if (user.role === 'BREEDER' && existing.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const recipe = await prisma.$transaction(async (tx) => {
    await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });

    return tx.recipe.update({
      where: { id },
      data: {
        name,
        dietType,
        portions,
        instructions,
        notes,
        isActive,
        ingredients: {
          create: (ingredients || []).map((ing: any) => ({
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
            costPerUnit: ing.costPerUnit,
            notes: ing.notes,
            inventoryItemId: ing.inventoryItemId,
          })),
        },
      },
      include: {
        ingredients: true,
        kennel: { select: { id: true, name: true } },
      },
    });
  });

  res.json({ recipe });
});

export const deleteRecipe = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const existing = await prisma.recipe.findUnique({
    where: { id },
    include: { kennel: { select: { breederId: true } }, _count: { select: { dogDiets: true } } },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Recipe not found' });
  }

  if (user.role === 'BREEDER' && existing.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (existing._count.dogDiets > 0) {
    return res.status(400).json({ error: 'Cannot delete recipe assigned to dogs. Please reassign diets first.' });
  }

  await prisma.recipe.delete({ where: { id } });

  res.json({ message: 'Recipe deleted successfully' });
});

export const calculateRecipeCost = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: { ingredients: true },
  });

  if (!recipe) {
    return res.status(404).json({ error: 'Recipe not found' });
  }

  if (user.role === 'BREEDER') {
    if (user.kennelId !== recipe.kennelId) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  let totalCost = 0;
  const ingredientCosts = recipe.ingredients.map((ing) => {
    const cost = (ing.costPerUnit || 0) * ing.quantity;
    totalCost += cost;
    return {
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      costPerUnit: ing.costPerUnit || 0,
      totalCost: cost,
    };
  });

  const costPerPortion = recipe.portions > 0 ? totalCost / recipe.portions : totalCost;

  res.json({
    recipeId: id,
    recipeName: recipe.name,
    totalCost,
    portions: recipe.portions,
    costPerPortion,
    ingredients: ingredientCosts,
  });
});
