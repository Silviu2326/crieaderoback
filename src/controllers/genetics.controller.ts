import { Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

// Helper: check kennel access
async function checkKennelAccess(user: any, kennelId: string) {
  if (user.role === 'MANAGER') return true;
  if (user.role === 'BREEDER') {
    return kennelId === user.kennelId;
  }
  return false;
}

// ==================== GENETIC TESTS ====================

export const getGeneticTests = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId } = req.query;
  const user = req.user!;

  const where: any = {};
  if (kennelId) where.kennelId = kennelId as string;

  if (user.role === 'BREEDER') {
    const effectiveKennelId = (kennelId as string) || user.kennelId;
    if (effectiveKennelId !== user.kennelId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!kennelId) {
      where.kennelId = user.kennelId;
    }
  }

  const tests = await prisma.geneticTest.findMany({
    where,
    include: {
      dog: { select: { id: true, name: true, breed: { select: { name: true } } } },
    },
    orderBy: { testDate: 'desc' },
  });

  res.json({ tests });
});

// ==================== BREEDING PLANS ====================

export const getBreedingPlans = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId } = req.query;
  const user = req.user!;

  const where: any = {};
  if (kennelId) where.kennelId = kennelId as string;

  if (user.role === 'BREEDER') {
    const effectiveKennelId = (kennelId as string) || user.kennelId;
    if (effectiveKennelId !== user.kennelId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!kennelId) {
      where.kennelId = user.kennelId;
    }
  }

  const plans = await prisma.breedingPlan.findMany({
    where,
    include: {
      father: { select: { id: true, name: true, breed: { select: { name: true } } } },
      mother: { select: { id: true, name: true, breed: { select: { name: true } } } },
    },
    orderBy: { plannedDate: 'desc' },
  });

  res.json({ plans });
});

// ==================== COI CALCULATION ====================

async function buildAncestorMap(dogId: string | null, visited = new Map<string, number>(), generation = 0): Promise<Map<string, number>> {
  if (!dogId || generation > 5) return visited;

  const existing = visited.get(dogId);
  if (existing !== undefined && existing <= generation) return visited;

  visited.set(dogId, generation);

  const dog = await prisma.dog.findUnique({
    where: { id: dogId },
    select: { fatherId: true, motherId: true },
  });

  if (!dog) return visited;

  await buildAncestorMap(dog.fatherId, visited, generation + 1);
  await buildAncestorMap(dog.motherId, visited, generation + 1);

  return visited;
}

function findCommonAncestors(
  fatherMap: Map<string, number>,
  motherMap: Map<string, number>
): Array<{ ancestorId: string; fatherGen: number; motherGen: number }> {
  const common: Array<{ ancestorId: string; fatherGen: number; motherGen: number }> = [];
  for (const [ancestorId, fatherGen] of fatherMap) {
    const motherGen = motherMap.get(ancestorId);
    if (motherGen !== undefined) {
      common.push({ ancestorId, fatherGen, motherGen });
    }
  }
  return common;
}

export const calculateCoi = asyncHandler(async (req: Request, res: Response) => {
  const { fatherId, motherId } = req.body;

  if (!fatherId || !motherId) {
    return res.status(400).json({ error: 'fatherId and motherId are required' });
  }

  const fatherMap = await buildAncestorMap(fatherId);
  const motherMap = await buildAncestorMap(motherId);

  const common = findCommonAncestors(fatherMap, motherMap);

  let coi = 0;
  for (const { fatherGen, motherGen } of common) {
    coi += Math.pow(0.5, fatherGen + motherGen + 1);
  }

  coi = Math.round(coi * 10000) / 100; // percentage with 2 decimals

  let riskLevel: string;
  let message: string;

  if (coi < 5) {
    riskLevel = 'LOW';
    message = 'Coeficiente de consanguinidad muy bajo. Cruce recomendado.';
  } else if (coi < 12.5) {
    riskLevel = 'MEDIUM';
    message = 'Coeficiente aceptable para la raza.';
  } else {
    riskLevel = 'HIGH';
    message = 'Coeficiente elevado. Se recomienda buscar un reproductor menos consanguíneo.';
  }

  res.json({ coi, riskLevel, message });
});
