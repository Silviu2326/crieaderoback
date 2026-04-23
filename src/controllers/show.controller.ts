import { Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

// Helper: check kennel access
async function checkKennelAccess(user: any, kennelId: string) {
  if (user.role === 'MANAGER') return true;
  if (user.role === 'BREEDER') {
    const kennel = await prisma.kennel.findUnique({ where: { id: kennelId }, select: { breederId: true } });
    return kennel?.breederId === user.id;
  }
  return false;
}

// ==================== SHOW EVENTS ====================

export const listShows = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, status } = req.query;
  const user = req.user!;

  const where: any = {};
  if (kennelId) where.kennelId = kennelId as string;
  if (status) where.status = status as string;

  if (user.role === 'BREEDER') {
    const myKennels = await prisma.kennel.findMany({ where: { breederId: user.id }, select: { id: true } });
    const myKennelIds = myKennels.map(k => k.id);
    if (kennelId && !myKennelIds.includes(kennelId as string)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!kennelId) where.kennelId = { in: myKennelIds };
  }

  const shows = await prisma.showEvent.findMany({
    where,
    orderBy: { startDate: 'desc' },
  });

  res.json({ shows });
});

export const getShow = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const show = await prisma.showEvent.findUnique({
    where: { id },
    include: {
      showDogs: { include: { dog: { select: { id: true, name: true, breed: { select: { name: true } }, photos: { where: { isMain: true }, take: 1 } } } } },
      results: { include: { dog: { select: { id: true, name: true, breed: { select: { name: true } } } } } },
      budget: true,
    },
  });

  if (!show) return res.status(404).json({ error: 'Show not found' });
  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, show.kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  res.json({ show });
});

export const createShow = asyncHandler(async (req: Request, res: Response) => {
  const { name, organizer, location, startDate, endDate, status, entryFee, federation, website, kennelId } = req.body;
  const user = req.user!;

  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const show = await prisma.showEvent.create({
    data: {
      name,
      organizer,
      location,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      status: status || 'UPCOMING',
      entryFee,
      federation,
      website,
      kennelId,
    },
  });

  res.status(201).json({ show });
});

export const updateShow = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const existing = await prisma.showEvent.findUnique({ where: { id }, select: { kennelId: true } });
  if (!existing) return res.status(404).json({ error: 'Show not found' });
  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, existing.kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const data: any = { ...req.body };
  if (data.startDate) data.startDate = new Date(data.startDate);
  if (data.endDate) data.endDate = new Date(data.endDate);

  const show = await prisma.showEvent.update({ where: { id }, data });
  res.json({ show });
});

export const deleteShow = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const existing = await prisma.showEvent.findUnique({ where: { id }, select: { kennelId: true } });
  if (!existing) return res.status(404).json({ error: 'Show not found' });
  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, existing.kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.showEvent.delete({ where: { id } });
  res.json({ success: true });
});

// ==================== SHOW DOGS ====================

export const listShowDogs = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { kennelId, status } = req.query;
  const user = req.user!;

  const where: any = {};
  if (id) where.showId = id;
  if (status) where.status = status as string;
  if (kennelId) where.kennelId = kennelId as string;

  if (user.role === 'BREEDER') {
    const myKennels = await prisma.kennel.findMany({ where: { breederId: user.id }, select: { id: true } });
    const myKennelIds = myKennels.map(k => k.id);
    if (kennelId && !myKennelIds.includes(kennelId as string)) return res.status(403).json({ error: 'Access denied' });
    if (!kennelId) where.kennelId = { in: myKennelIds };
  }

  const showDogs = await prisma.showDog.findMany({
    where,
    include: {
      show: { select: { id: true, name: true } },
      dog: { select: { id: true, name: true, breed: { select: { name: true } }, photos: { where: { isMain: true }, take: 1 } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ showDogs });
});

export const listAllShowDogs = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, status } = req.query;
  const user = req.user!;

  const where: any = {};
  if (status) where.status = status as string;
  if (kennelId) where.kennelId = kennelId as string;

  if (user.role === 'BREEDER') {
    const myKennels = await prisma.kennel.findMany({ where: { breederId: user.id }, select: { id: true } });
    const myKennelIds = myKennels.map(k => k.id);
    if (kennelId && !myKennelIds.includes(kennelId as string)) return res.status(403).json({ error: 'Access denied' });
    if (!kennelId) where.kennelId = { in: myKennelIds };
  }

  const showDogs = await prisma.showDog.findMany({
    where,
    include: {
      show: { select: { id: true, name: true } },
      dog: { select: { id: true, name: true, breed: { select: { name: true } }, photos: { where: { isMain: true }, take: 1 } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ showDogs });
});

export const createShowDog = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { dogId, status, className, handlerName, kennelId } = req.body;
  const user = req.user!;

  const show = await prisma.showEvent.findUnique({ where: { id }, select: { kennelId: true } });
  if (!show) return res.status(404).json({ error: 'Show not found' });
  const effectiveKennelId = kennelId || show.kennelId;
  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, effectiveKennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const showDog = await prisma.showDog.create({
    data: { showId: id, dogId, status: status || 'REGISTERED', className, handlerName, kennelId: effectiveKennelId },
  });
  res.status(201).json({ showDog });
});

export const updateShowDog = asyncHandler(async (req: Request, res: Response) => {
  const { id, showDogId } = req.params;
  const user = req.user!;

  const existing = await prisma.showDog.findUnique({ where: { id: showDogId }, select: { kennelId: true } });
  if (!existing) return res.status(404).json({ error: 'Show dog not found' });
  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, existing.kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const showDog = await prisma.showDog.update({ where: { id: showDogId }, data: req.body });
  res.json({ showDog });
});

export const deleteShowDog = asyncHandler(async (req: Request, res: Response) => {
  const { id, showDogId } = req.params;
  const user = req.user!;

  const existing = await prisma.showDog.findUnique({ where: { id: showDogId }, select: { kennelId: true } });
  if (!existing) return res.status(404).json({ error: 'Show dog not found' });
  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, existing.kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.showDog.delete({ where: { id: showDogId } });
  res.json({ success: true });
});

// ==================== SHOW RESULTS ====================

export const listShowResults = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { kennelId, category } = req.query;
  const user = req.user!;

  const where: any = {};
  if (id) where.showId = id;
  if (category) where.category = category as string;
  if (kennelId) where.kennelId = kennelId as string;

  if (user.role === 'BREEDER') {
    const myKennels = await prisma.kennel.findMany({ where: { breederId: user.id }, select: { id: true } });
    const myKennelIds = myKennels.map(k => k.id);
    if (kennelId && !myKennelIds.includes(kennelId as string)) return res.status(403).json({ error: 'Access denied' });
    if (!kennelId) where.kennelId = { in: myKennelIds };
  }

  const results = await prisma.showResult.findMany({
    where,
    include: {
      show: { select: { id: true, name: true } },
      dog: { select: { id: true, name: true, breed: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ results });
});

export const listAllShowResults = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, category } = req.query;
  const user = req.user!;

  const where: any = {};
  if (category) where.category = category as string;
  if (kennelId) where.kennelId = kennelId as string;

  if (user.role === 'BREEDER') {
    const myKennels = await prisma.kennel.findMany({ where: { breederId: user.id }, select: { id: true } });
    const myKennelIds = myKennels.map(k => k.id);
    if (kennelId && !myKennelIds.includes(kennelId as string)) return res.status(403).json({ error: 'Access denied' });
    if (!kennelId) where.kennelId = { in: myKennelIds };
  }

  const results = await prisma.showResult.findMany({
    where,
    include: {
      show: { select: { id: true, name: true } },
      dog: { select: { id: true, name: true, breed: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ results });
});

export const createShowResult = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { dogId, category, placement, points, titleEarned, judgeName, notes, kennelId } = req.body;
  const user = req.user!;

  const show = await prisma.showEvent.findUnique({ where: { id }, select: { kennelId: true } });
  if (!show) return res.status(404).json({ error: 'Show not found' });
  const effectiveKennelId = kennelId || show.kennelId;
  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, effectiveKennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const result = await prisma.showResult.create({
    data: { showId: id, dogId, category, placement, points, titleEarned, judgeName, notes, kennelId: effectiveKennelId },
  });
  res.status(201).json({ result });
});

export const updateShowResult = asyncHandler(async (req: Request, res: Response) => {
  const { id, resultId } = req.params;
  const user = req.user!;

  const existing = await prisma.showResult.findUnique({ where: { id: resultId }, select: { kennelId: true } });
  if (!existing) return res.status(404).json({ error: 'Show result not found' });
  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, existing.kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const result = await prisma.showResult.update({ where: { id: resultId }, data: req.body });
  res.json({ result });
});

export const deleteShowResult = asyncHandler(async (req: Request, res: Response) => {
  const { id, resultId } = req.params;
  const user = req.user!;

  const existing = await prisma.showResult.findUnique({ where: { id: resultId }, select: { kennelId: true } });
  if (!existing) return res.status(404).json({ error: 'Show result not found' });
  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, existing.kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.showResult.delete({ where: { id: resultId } });
  res.json({ success: true });
});

// ==================== SHOW BUDGET ====================

export const listShowBudget = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { kennelId, category } = req.query;
  const user = req.user!;

  const where: any = {};
  if (id) where.showId = id;
  if (category) where.category = category as string;
  if (kennelId) where.kennelId = kennelId as string;

  if (user.role === 'BREEDER') {
    const myKennels = await prisma.kennel.findMany({ where: { breederId: user.id }, select: { id: true } });
    const myKennelIds = myKennels.map(k => k.id);
    if (kennelId && !myKennelIds.includes(kennelId as string)) return res.status(403).json({ error: 'Access denied' });
    if (!kennelId) where.kennelId = { in: myKennelIds };
  }

  const budgetItems = await prisma.showBudgetItem.findMany({
    where,
    include: { show: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ budgetItems });
});

export const listAllShowBudget = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, category } = req.query;
  const user = req.user!;

  const where: any = {};
  if (category) where.category = category as string;
  if (kennelId) where.kennelId = kennelId as string;

  if (user.role === 'BREEDER') {
    const myKennels = await prisma.kennel.findMany({ where: { breederId: user.id }, select: { id: true } });
    const myKennelIds = myKennels.map(k => k.id);
    if (kennelId && !myKennelIds.includes(kennelId as string)) return res.status(403).json({ error: 'Access denied' });
    if (!kennelId) where.kennelId = { in: myKennelIds };
  }

  const budgetItems = await prisma.showBudgetItem.findMany({
    where,
    include: { show: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ budgetItems });
});

export const createShowBudgetItem = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { concept, estimatedCost, actualCost, category, paid, kennelId } = req.body;
  const user = req.user!;

  const show = await prisma.showEvent.findUnique({ where: { id }, select: { kennelId: true } });
  if (!show) return res.status(404).json({ error: 'Show not found' });
  const effectiveKennelId = kennelId || show.kennelId;
  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, effectiveKennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const budgetItem = await prisma.showBudgetItem.create({
    data: { showId: id, concept, estimatedCost, actualCost, category, paid, kennelId: effectiveKennelId },
  });
  res.status(201).json({ budgetItem });
});

export const updateShowBudgetItem = asyncHandler(async (req: Request, res: Response) => {
  const { id, itemId } = req.params;
  const user = req.user!;

  const existing = await prisma.showBudgetItem.findUnique({ where: { id: itemId }, select: { kennelId: true } });
  if (!existing) return res.status(404).json({ error: 'Budget item not found' });
  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, existing.kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const budgetItem = await prisma.showBudgetItem.update({ where: { id: itemId }, data: req.body });
  res.json({ budgetItem });
});

export const deleteShowBudgetItem = asyncHandler(async (req: Request, res: Response) => {
  const { id, itemId } = req.params;
  const user = req.user!;

  const existing = await prisma.showBudgetItem.findUnique({ where: { id: itemId }, select: { kennelId: true } });
  if (!existing) return res.status(404).json({ error: 'Budget item not found' });
  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, existing.kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.showBudgetItem.delete({ where: { id: itemId } });
  res.json({ success: true });
});
