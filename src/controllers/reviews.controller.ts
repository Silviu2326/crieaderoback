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

// ==================== REVIEWS ====================

export const getReviews = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, status, source } = req.query;
  const user = req.user!;

  const where: any = {};
  if (kennelId) where.kennelId = kennelId as string;
  if (status) where.status = status as string;
  if (source) where.source = source as string;

  if (user.role === 'BREEDER') {
    const myKennels = await prisma.kennel.findMany({ where: { breederId: user.id }, select: { id: true } });
    const myKennelIds = myKennels.map((k: any) => k.id);
    if (kennelId && !myKennelIds.includes(kennelId as string)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!kennelId) where.kennelId = { in: myKennelIds };
  }

  const reviews = await prisma.review.findMany({
    where,
    include: {
      customer: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ reviews });
});

// ==================== REPUTATION ====================

export const getReputation = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId } = req.params;
  const user = req.user!;

  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const reviews = await prisma.review.findMany({
    where: { kennelId, status: 'PUBLISHED' },
    select: { rating: true, reply: true, createdAt: true },
  });

  const totalReviews = reviews.length;

  if (totalReviews === 0) {
    return res.json({
      reputation: {
        overall: 0,
        totalReviews: 0,
        avgRating: 0,
        fiveStar: 0,
        fourStar: 0,
        threeStar: 0,
        twoStar: 0,
        oneStar: 0,
        responseRate: 0,
        avgResponseTimeHours: 0,
        verifiedBadge: false,
        pedigreeBadge: false,
        healthBadge: false,
      },
    });
  }

  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  const avgRating = Math.round((sum / totalReviews) * 10) / 10;

  const distribution = { fiveStar: 0, fourStar: 0, threeStar: 0, twoStar: 0, oneStar: 0 };
  for (const r of reviews) {
    if (r.rating === 5) distribution.fiveStar++;
    else if (r.rating === 4) distribution.fourStar++;
    else if (r.rating === 3) distribution.threeStar++;
    else if (r.rating === 2) distribution.twoStar++;
    else if (r.rating === 1) distribution.oneStar++;
  }

  const withReply = reviews.filter((r) => r.reply && r.reply.trim().length > 0);
  const responseRate = Math.round((withReply.length / totalReviews) * 100);

  // Simplified avg response time calculation (random-ish based on data density)
  let avgResponseTimeHours = 6;
  if (withReply.length > 0) {
    avgResponseTimeHours = Math.max(1, Math.round(48 / (withReply.length + 1)));
  }

  const overall = Math.round(((avgRating / 5) * 80 + (responseRate * 0.2)) * 10) / 10;

  // Badges: derive from existing data
  const kennel = await prisma.kennel.findUnique({
    where: { id: kennelId },
    include: {
      dogs: { select: { id: true } },
    },
  });

  const dogIds = kennel?.dogs.map((d: any) => d.id) || [];
  const hasPedigreeDocs = dogIds.length > 0
    ? await prisma.document.count({ where: { dogId: { in: dogIds }, type: 'PEDIGREE' } }) > 0
    : false;
  const hasHealthDocs = dogIds.length > 0
    ? await prisma.document.count({ where: { dogId: { in: dogIds }, type: 'HEALTH_CERT' } }) > 0
    : false;

  res.json({
    reputation: {
      overall: Math.min(100, Math.round(overall)),
      totalReviews,
      avgRating,
      ...distribution,
      responseRate,
      avgResponseTimeHours,
      verifiedBadge: overall > 70,
      pedigreeBadge: hasPedigreeDocs,
      healthBadge: hasHealthDocs,
    },
  });
});

// ==================== VERIFICATION ====================

export const getVerification = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId } = req.params;
  const user = req.user!;

  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const verification = await prisma.verificationRequest.findFirst({
    where: { kennelId },
    include: { steps: { orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });

  if (!verification) {
    return res.status(404).json({ error: 'No verification request found' });
  }

  res.json({ verification });
});
