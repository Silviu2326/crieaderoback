import { Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

// Kennel reports (for breeders)
export const getKennelReport = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const { kennelId, startDate, endDate } = req.query;

  if (!kennelId) {
    return res.status(400).json({ error: 'Kennel ID required' });
  }

  // Access control
  if (user.role === 'BREEDER') {
    const kennel = await prisma.kennel.findUnique({
      where: { id: kennelId as string },
    });
    if (!kennel || kennel.breederId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate as string) : new Date();

  const [
    dogStats,
    reservationStats,
    customerStats,
    salesTotal,
    upcomingVaccines,
    recentDogs,
    recentReservations,
  ] = await Promise.all([
    // Dog statistics by status
    prisma.dog.groupBy({
      by: ['status'],
      where: { kennelId: kennelId as string },
      _count: { status: true },
    }),

    // Reservation statistics
    prisma.reservation.groupBy({
      by: ['status'],
      where: { kennelId: kennelId as string },
      _count: { status: true },
    }),

    // Customer count
    prisma.customer.count({
      where: {
        kennelId: kennelId as string,
        isArchived: false,
      },
    }),

    // Total sales in period
    prisma.reservation.aggregate({
      where: {
        kennelId: kennelId as string,
        status: 'COMPLETED',
        completedAt: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),

    // Upcoming vaccines
    prisma.medicalRecord.count({
      where: {
        dog: { kennelId: kennelId as string },
        nextDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),

    // Recent dogs added
    prisma.dog.findMany({
      where: { kennelId: kennelId as string },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
      },
    }),

    // Recent reservations
    prisma.reservation.findMany({
      where: { kennelId: kennelId as string },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        dog: { select: { name: true } },
        customer: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  res.json({
    report: {
      period: { start, end },
      dogs: dogStats,
      reservations: reservationStats,
      activeCustomers: customerStats,
      totalSales: salesTotal._sum.amount || 0,
      upcomingVaccines,
      recentDogs,
      recentReservations,
    },
  });
});

// Manager reports (global or by kennel)
export const getManagerReport = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;

  if (user.role !== 'MANAGER') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { startDate, endDate, kennelId } = req.query;

  const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate as string) : new Date();

  const kennelIdStr = kennelId as string | undefined;

  // Base queries
  const [
    totalKennels,
    totalDogs,
    totalCustomers,
    totalReservations,
    kennelActivity,
  ] = await Promise.all([
    kennelIdStr
      ? prisma.kennel.count({ where: { id: kennelIdStr } })
      : prisma.kennel.count(),
    kennelIdStr
      ? prisma.dog.count({ where: { kennelId: kennelIdStr } })
      : prisma.dog.count(),
    kennelIdStr
      ? prisma.customer.count({ where: { kennelId: kennelIdStr, isArchived: false } })
      : prisma.customer.count({ where: { isArchived: false } }),
    kennelIdStr
      ? prisma.reservation.count({ where: { kennelId: kennelIdStr } })
      : prisma.reservation.count(),

    // Kennel activity
    kennelIdStr
      ? prisma.kennel.findMany({
          where: { id: kennelIdStr },
          select: {
            id: true,
            name: true,
            status: true,
            _count: {
              select: { dogs: true, customers: true, reservations: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        })
      : prisma.kennel.findMany({
          select: {
            id: true,
            name: true,
            status: true,
            _count: {
              select: { dogs: true, customers: true, reservations: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
  ]);

  // User stats: when filtering by kennel, compute role counts manually
  let totalUsers = 0;
  let userStats: any[] = [];

  if (kennelIdStr) {
    const [breederCount, vetCount, managerCount] = await Promise.all([
      prisma.kennel.count({ where: { id: kennelIdStr } }).then((c) => (c > 0 ? 1 : 0)),
      prisma.kennelVet.count({ where: { kennelId: kennelIdStr } }),
      prisma.user.count({ where: { role: 'MANAGER' } }),
    ]);

    totalUsers = breederCount + vetCount + managerCount;
    userStats = [
      { role: 'MANAGER', _count: { role: managerCount } },
      { role: 'BREEDER', _count: { role: breederCount } },
      { role: 'VETERINARIAN', _count: { role: vetCount } },
    ].filter((s) => s._count.role > 0);
  } else {
    totalUsers = await prisma.user.count();
    // @ts-ignore — Prisma groupBy typing issue with orderBy aggregation
    userStats = await prisma.user.groupBy({
      by: ['role'],
      _count: { role: true },
    });
  }

  res.json({
    report: {
      period: { start, end },
      totals: {
        kennels: totalKennels,
        dogs: totalDogs,
        users: totalUsers,
        customers: totalCustomers,
        reservations: totalReservations,
      },
      kennelActivity,
      userStats,
    },
  });
});

// Get sales report
export const getSalesReport = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const { kennelId, startDate, endDate } = req.query;

  const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate as string) : new Date();

  const where: any = {
    status: 'COMPLETED',
    completedAt: { gte: start, lte: end },
  };

  if (kennelId) {
    // Access control
    if (user.role === 'BREEDER' && kennelId !== user.kennelId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    where.kennelId = kennelId as string;
  } else if (user.role === 'BREEDER') {
    where.kennelId = user.kennelId;
  }

  const [totalSales, salesByMonth, topCustomers, recentSales] = await Promise.all([
    prisma.reservation.aggregate({
      where,
      _sum: { amount: true },
      _count: true,
    }),

    // Monthly breakdown (simplified)
    prisma.reservation.findMany({
      where,
      select: {
        completedAt: true,
        amount: true,
      },
      orderBy: { completedAt: 'asc' },
    }),

    // Top customers
    prisma.reservation.groupBy({
      by: ['customerId'],
      where,
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: 'desc' } },
      take: 10,
    }),

    // Recent sales
    prisma.reservation.findMany({
      where,
      orderBy: { completedAt: 'desc' },
      take: 20,
      include: {
        dog: { select: { name: true, breed: { select: { name: true } } } },
        customer: { select: { firstName: true, lastName: true } },
        kennel: { select: { name: true } },
      },
    }),
  ]);

  res.json({
    report: {
      period: { start, end },
      totalSales: totalSales._sum.amount || 0,
      totalTransactions: totalSales._count,
      salesData: salesByMonth,
      topCustomers,
      recentSales,
    },
  });
});

// Get popular breeds report
export const getBreedReport = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const { kennelId } = req.query;

  const where: any = {};

  if (kennelId) {
    if (user.role === 'BREEDER' && kennelId !== user.kennelId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    where.kennelId = kennelId as string;
  } else if (user.role === 'BREEDER') {
    where.kennelId = user.kennelId;
  }

  const breeds = await prisma.dog.groupBy({
    by: ['breedId'],
    where,
    _count: { breedId: true },
  });

  const breedDetails = await prisma.breed.findMany({
    where: { id: { in: breeds.map((b) => b.breedId) } },
    select: { id: true, name: true },
  });

  const result = breeds.map((b) => ({
    breedId: b.breedId,
    breedName: breedDetails.find((bd) => bd.id === b.breedId)?.name || 'Unknown',
    count: b._count.breedId,
  }));

  res.json({ breeds: result.sort((a, b) => b.count - a.count) });
});
