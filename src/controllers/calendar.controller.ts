import { Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

// List calendar events
export const listEvents = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, startDate, endDate, type, dogId, status } = req.query;
  const user = req.user!;

  const where: any = {};

  if (kennelId) where.kennelId = kennelId as string;
  if (type) where.type = type as string;
  if (dogId) where.dogId = dogId as string;
  if (status) where.status = status as string;

  // Date range filter
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate as string);
    if (endDate) where.date.lte = new Date(endDate as string);
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

    const assignedKennelIds = vet?.kennels.map(k => k.kennelId) || [];

    if (kennelId && !assignedKennelIds.includes(kennelId as string)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!kennelId) {
      where.kennelId = { in: assignedKennelIds };
    }
  }

  const events = await prisma.calendarEvent.findMany({
    where,
    include: {
      dog: {
        select: {
          id: true,
          name: true,
          breed: { select: { name: true } },
          photos: { where: { isMain: true }, take: 1 },
        },
      },
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      kennel: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { date: 'asc' },
  });

  res.json({ events });
});

// Get single event
export const getEvent = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const event = await prisma.calendarEvent.findUnique({
    where: { id },
    include: {
      dog: {
        select: {
          id: true,
          name: true,
          breed: { select: { name: true } },
          photos: { where: { isMain: true }, take: 1 },
        },
      },
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      kennel: {
        select: {
          id: true,
          name: true,
          breederId: true,
        },
      },
    },
  });

  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  // Access control
  if (user.role === 'BREEDER' && event.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (user.role === 'VETERINARIAN') {
    const vet = await prisma.veterinarian.findUnique({
      where: { userId: user.id },
    });
    const isAssigned = await prisma.kennelVet.findUnique({
      where: {
        kennelId_vetId: {
          kennelId: event.kennelId,
          vetId: vet?.id || '',
        },
      },
    });
    if (!isAssigned) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  res.json({ event });
});

// Create event
export const createEvent = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const {
    title,
    type,
    date,
    endDate,
    allDay,
    reminderDays,
    notes,
    location,
    kennelId,
    dogId,
    customerId,
    litterId,
  } = req.body;

  // Check access to kennel
  if (user.role === 'BREEDER') {
    const resolvedKennelId = kennelId || user.kennelId;
    const kennel = await prisma.kennel.findUnique({
      where: { id: resolvedKennelId },
    });
    if (!kennel || kennel.breederId !== user.id) {
      return res.status(403).json({ error: 'Access denied to this kennel' });
    }
  }

  // Validate dog belongs to kennel if provided
  if (dogId) {
    const dog = await prisma.dog.findUnique({
      where: { id: dogId },
    });
    if (!dog || dog.kennelId !== kennelId) {
      return res.status(400).json({ error: 'Invalid dog selection' });
    }
  }

  // Validate customer belongs to kennel if provided
  if (customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer || customer.kennelId !== kennelId) {
      return res.status(400).json({ error: 'Invalid customer selection' });
    }
  }

  const event = await prisma.calendarEvent.create({
    data: {
      title,
      type,
      date: new Date(date),
      endDate: endDate ? new Date(endDate) : null,
      allDay: allDay ?? true,
      reminderDays: reminderDays ?? 1,
      notes,
      location,
      kennelId,
      dogId,
      customerId,
      litterId,
      createdBy: user.id,
    },
    include: {
      dog: {
        select: {
          id: true,
          name: true,
          breed: { select: { name: true } },
        },
      },
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  res.status(201).json({ event });
});

// Update event
export const updateEvent = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;
  const updateData = req.body;

  const event = await prisma.calendarEvent.findUnique({
    where: { id },
    include: { kennel: true },
  });

  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  // Check access
  if (user.role === 'BREEDER' && event.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (user.role === 'VETERINARIAN') {
    const vet = await prisma.veterinarian.findUnique({
      where: { userId: user.id },
    });
    const isAssigned = await prisma.kennelVet.findUnique({
      where: {
        kennelId_vetId: {
          kennelId: event.kennelId,
          vetId: vet?.id || '',
        },
      },
    });
    if (!isAssigned) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  const data: any = {};

  if (updateData.title) data.title = updateData.title;
  if (updateData.type) data.type = updateData.type;
  if (updateData.date) data.date = new Date(updateData.date);
  if (updateData.endDate !== undefined) data.endDate = updateData.endDate ? new Date(updateData.endDate) : null;
  if (updateData.allDay !== undefined) data.allDay = updateData.allDay;
  if (updateData.reminderDays !== undefined) data.reminderDays = updateData.reminderDays;
  if (updateData.notes !== undefined) data.notes = updateData.notes;
  if (updateData.location !== undefined) data.location = updateData.location;
  if (updateData.status) data.status = updateData.status;
  if (updateData.dogId !== undefined) data.dogId = updateData.dogId || null;
  if (updateData.customerId !== undefined) data.customerId = updateData.customerId || null;

  const updatedEvent = await prisma.calendarEvent.update({
    where: { id },
    data,
    include: {
      dog: {
        select: {
          id: true,
          name: true,
          breed: { select: { name: true } },
        },
      },
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  res.json({ event: updatedEvent });
});

// Toggle event status
export const toggleStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const event = await prisma.calendarEvent.findUnique({
    where: { id },
    include: { kennel: true },
  });

  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  if (user.role === 'BREEDER' && event.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const newStatus = event.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';

  const updatedEvent = await prisma.calendarEvent.update({
    where: { id },
    data: { status: newStatus },
    select: { id: true, title: true, status: true },
  });

  res.json({
    message: `Event is now ${newStatus.toLowerCase()}`,
    event: updatedEvent,
  });
});

// Delete event
export const deleteEvent = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const event = await prisma.calendarEvent.findUnique({
    where: { id },
    include: { kennel: true },
  });

  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  if (user.role === 'BREEDER' && event.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.calendarEvent.delete({ where: { id } });

  res.json({ message: 'Event deleted successfully' });
});

// Get upcoming events
export const getUpcomingEvents = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, days = 7 } = req.query;
  const user = req.user!;

  const where: any = {
    status: 'PENDING',
    date: {
      gte: new Date(),
      lte: new Date(Date.now() + parseInt(days as string) * 24 * 60 * 60 * 1000),
    },
  };

  if (kennelId) where.kennelId = kennelId as string;

  // Access control
  if (user.role === 'BREEDER') {
    const effectiveKennelId = (kennelId as string) || user.kennelId;
    if (effectiveKennelId !== user.kennelId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!kennelId) {
      where.kennelId = user.kennelId;
    }
  }

  const events = await prisma.calendarEvent.findMany({
    where,
    include: {
      dog: {
        select: {
          id: true,
          name: true,
          photos: { where: { isMain: true }, take: 1 },
        },
      },
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { date: 'asc' },
    take: 20,
  });

  res.json({ events });
});

// Get events by date range (for calendar view)
export const getEventsByRange = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, startDate, endDate } = req.query;
  const user = req.user!;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Start and end dates are required' });
  }

  const where: any = {
    date: {
      gte: new Date(startDate as string),
      lte: new Date(endDate as string),
    },
  };

  if (kennelId) where.kennelId = kennelId as string;

  // Access control
  if (user.role === 'BREEDER') {
    const effectiveKennelId = (kennelId as string) || user.kennelId;
    if (effectiveKennelId !== user.kennelId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!kennelId) {
      where.kennelId = user.kennelId;
    }
  }

  const events = await prisma.calendarEvent.findMany({
    where,
    select: {
      id: true,
      title: true,
      type: true,
      date: true,
      endDate: true,
      allDay: true,
      status: true,
      dogId: true,
      customerId: true,
      dog: {
        select: {
          name: true,
          photos: { where: { isMain: true }, take: 1 },
        },
      },
    },
    orderBy: { date: 'asc' },
  });

  res.json({ events });
});

// Create event from medical record
export const createFromMedical = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const { medicalRecordId, kennelId } = req.body;

  const medicalRecord = await prisma.medicalRecord.findUnique({
    where: { id: medicalRecordId },
    include: { dog: true },
  });

  if (!medicalRecord) {
    return res.status(404).json({ error: 'Medical record not found' });
  }

  // Check access
  if (user.role === 'BREEDER') {
    const resolvedKennelId = kennelId || user.kennelId;
    const kennel = await prisma.kennel.findUnique({
      where: { id: resolvedKennelId },
    });
    if (!kennel || kennel.breederId !== user.id) {
      return res.status(403).json({ error: 'Access denied to this kennel' });
    }
  }

  // Create event based on medical record type
  const eventType = medicalRecord.type === 'VACCINE' ? 'VACCINE' :
                    medicalRecord.type === 'DEWORMING' ? 'DEWORMING' : 'OTHER';

  const event = await prisma.calendarEvent.create({
    data: {
      title: `${eventType}: ${medicalRecord.dog.name}`,
      type: eventType,
      date: medicalRecord.date,
      notes: medicalRecord.description,
      kennelId,
      dogId: medicalRecord.dogId,
      createdBy: user.id,
    },
    include: {
      dog: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  res.status(201).json({ event });
});
