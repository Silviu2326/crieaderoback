import { Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

type ActivityType =
  | 'RESERVATION'
  | 'MEDICAL'
  | 'LITTER'
  | 'TASK'
  | 'CUSTOMER'
  | 'TRANSACTION'
  | 'DOG';

interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  subtitle: string;
  entityId: string;
  createdAt: Date;
}

export const getActivity = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const { kennelId: queryKennelId, limit = '20' } = req.query;

  let effectiveKennelId = queryKennelId as string | undefined;

  if (!effectiveKennelId) {
    effectiveKennelId = user.kennelId || undefined;
  }

  if (!effectiveKennelId) {
    return res.status(400).json({ error: 'Kennel ID is required' });
  }

  // Access control
  if (user.role === 'BREEDER') {
    const kennel = await prisma.kennel.findUnique({
      where: { id: effectiveKennelId },
      select: { breederId: true },
    });
    if (!kennel || kennel.breederId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  if (user.role === 'VETERINARIAN') {
    const vet = await prisma.veterinarian.findUnique({
      where: { userId: user.id },
      include: { kennels: { select: { kennelId: true } } },
    });
    const assigned = vet?.kennels.map((k) => k.kennelId) || [];
    if (!assigned.includes(effectiveKennelId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  const take = Math.min(parseInt(limit as string, 10) || 20, 50);

  const [
    reservations,
    medicalRecords,
    litters,
    tasks,
    customers,
    transactions,
    dogs,
  ] = await Promise.all([
    prisma.reservation.findMany({
      where: { kennelId: effectiveKennelId },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        dog: { select: { name: true } },
        customer: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.medicalRecord.findMany({
      where: { dog: { kennelId: effectiveKennelId } },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        dog: { select: { name: true } },
      },
    }),
    prisma.litter.findMany({
      where: { kennelId: effectiveKennelId },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        father: { select: { name: true } },
        mother: { select: { name: true } },
      },
    }),
    prisma.task.findMany({
      where: { kennelId: effectiveKennelId, isTemplate: false },
      orderBy: { createdAt: 'desc' },
      take,
    }),
    prisma.customer.findMany({
      where: { kennelId: effectiveKennelId },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    }),
    prisma.transaction.findMany({
      where: { kennelId: effectiveKennelId },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        category: { select: { name: true } },
      },
    }),
    prisma.dog.findMany({
      where: { kennelId: effectiveKennelId },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        name: true,
        breed: { select: { name: true } },
        createdAt: true,
      },
    }),
  ]);

  const activities: ActivityItem[] = [];

  reservations.forEach((r) => {
    activities.push({
      id: `res-${r.id}`,
      type: 'RESERVATION',
      title:
        r.status === 'COMPLETED'
          ? 'Venta confirmada'
          : r.status === 'CONFIRMED'
          ? 'Reserva confirmada'
          : 'Nueva reserva',
      subtitle: `${r.dog?.name || 'Cachorro'} — ${r.customer?.firstName || ''} ${r.customer?.lastName || ''}`.trim(),
      entityId: r.id,
      createdAt: r.createdAt,
    });
  });

  medicalRecords.forEach((m) => {
    const typeLabel: Record<string, string> = {
      VACCINE: 'Vacuna registrada',
      DEWORMING: 'Desparasitacion',
      CONSULTATION: 'Consulta veterinaria',
      EXAM: 'Examen',
      SURGERY: 'Cirugia',
      OTHER: 'Registro medico',
    };
    activities.push({
      id: `med-${m.id}`,
      type: 'MEDICAL',
      title: typeLabel[m.type] || 'Registro medico',
      subtitle: m.dog?.name || 'Perro',
      entityId: m.id,
      createdAt: m.createdAt,
    });
  });

  litters.forEach((l) => {
    activities.push({
      id: `lit-${l.id}`,
      type: 'LITTER',
      title: 'Nueva camada',
      subtitle: `${l.mother?.name || 'Madre'} x ${l.father?.name || 'Padre'}`,
      entityId: l.id,
      createdAt: l.createdAt,
    });
  });

  tasks.forEach((t) => {
    activities.push({
      id: `task-${t.id}`,
      type: 'TASK',
      title: t.status === 'COMPLETED' ? 'Tarea completada' : 'Nueva tarea',
      subtitle: t.title,
      entityId: t.id,
      createdAt: t.createdAt,
    });
  });

  customers.forEach((c) => {
    activities.push({
      id: `cust-${c.id}`,
      type: 'CUSTOMER',
      title: 'Nuevo cliente',
      subtitle: `${c.firstName} ${c.lastName}`.trim(),
      entityId: c.id,
      createdAt: c.createdAt,
    });
  });

  transactions.forEach((t) => {
    activities.push({
      id: `trx-${t.id}`,
      type: 'TRANSACTION',
      title: t.type === 'INCOME' ? 'Ingreso registrado' : 'Gasto registrado',
      subtitle: `${t.category?.name || ''} — ${t.amount.toLocaleString('es-ES')} €`.trim(),
      entityId: t.id,
      createdAt: t.createdAt,
    });
  });

  dogs.forEach((d) => {
    activities.push({
      id: `dog-${d.id}`,
      type: 'DOG',
      title: 'Nuevo perro registrado',
      subtitle: `${d.name}${d.breed?.name ? ` (${d.breed.name})` : ''}`,
      entityId: d.id,
      createdAt: d.createdAt,
    });
  });

  activities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const limited = activities.slice(0, take);

  res.json({ activities: limited });
});
