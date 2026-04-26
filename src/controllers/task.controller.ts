import { Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

// List tasks
export const listTasks = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, status, priority, assignedTo, search, dueDateFrom, dueDateTo, isTemplate } = req.query;
  const user = req.user!;

  const where: any = {};

  if (kennelId) where.kennelId = kennelId as string;
  if (status) where.status = status as string;
  if (priority) where.priority = priority as string;
  if (assignedTo) where.assignedTo = assignedTo as string;
  if (isTemplate !== undefined) where.isTemplate = isTemplate === 'true';
  else where.isTemplate = false;

  if (search) {
    where.title = { contains: search as string, mode: 'insensitive' };
  }

  if (dueDateFrom || dueDateTo) {
    where.dueDate = {};
    if (dueDateFrom) where.dueDate.gte = new Date(dueDateFrom as string);
    if (dueDateTo) where.dueDate.lte = new Date(dueDateTo as string);
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

  const tasks = await prisma.task.findMany({
    where,
    include: {
      assignee: {
        select: { id: true, firstName: true, lastName: true },
      },
      creator: {
        select: { id: true, firstName: true, lastName: true },
      },
      dog: {
        select: {
          id: true,
          name: true,
          breed: { select: { name: true } },
          photos: { where: { isMain: true }, take: 1 },
        },
      },
      customer: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      kennel: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ tasks });
});

// Get single task
export const getTask = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignee: {
        select: { id: true, firstName: true, lastName: true },
      },
      creator: {
        select: { id: true, firstName: true, lastName: true },
      },
      dog: {
        select: {
          id: true,
          name: true,
          breed: { select: { name: true } },
          photos: { where: { isMain: true }, take: 1 },
        },
      },
      customer: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      kennel: {
        select: { id: true, name: true, breederId: true },
      },
    },
  });

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // Access control
  if (user.role === 'BREEDER' && task.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (user.role === 'VETERINARIAN') {
    const vet = await prisma.veterinarian.findUnique({
      where: { userId: user.id },
    });
    const isAssigned = await prisma.kennelVet.findUnique({
      where: {
        kennelId_vetId: {
          kennelId: task.kennelId,
          vetId: vet?.id || '',
        },
      },
    });
    if (!isAssigned) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  res.json({ task });
});

// Create task
export const createTask = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const {
    title,
    description,
    status,
    priority,
    dueDate,
    tags,
    recurrenceRule,
    isTemplate,
    kennelId,
    assignedTo,
    dogId,
    customerId,
    litterId,
  } = req.body;

  // Check access to kennel
  if (user.role === 'BREEDER') {
    const kennel = await prisma.kennel.findUnique({ where: { id: kennelId } });
    if (!kennel || kennel.breederId !== user.id) {
      return res.status(403).json({ error: 'Access denied to this kennel' });
    }
  }

  if (user.role === 'VETERINARIAN') {
    const vet = await prisma.veterinarian.findUnique({ where: { userId: user.id } });
    const isAssigned = await prisma.kennelVet.findUnique({
      where: { kennelId_vetId: { kennelId, vetId: vet?.id || '' } },
    });
    if (!isAssigned) {
      return res.status(403).json({ error: 'Access denied to this kennel' });
    }
  }

  // Validate dog belongs to kennel if provided
  if (dogId) {
    const dog = await prisma.dog.findUnique({ where: { id: dogId } });
    if (!dog || dog.kennelId !== kennelId) {
      return res.status(400).json({ error: 'Invalid dog selection' });
    }
  }

  // Validate customer belongs to kennel if provided
  if (customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || customer.kennelId !== kennelId) {
      return res.status(400).json({ error: 'Invalid customer selection' });
    }
  }

  const task = await prisma.task.create({
    data: {
      title,
      description,
      status: status || 'PENDING',
      priority: priority || 'MEDIUM',
      dueDate: dueDate ? new Date(dueDate) : null,
      tags,
      recurrenceRule,
      isTemplate: isTemplate ?? false,
      kennelId,
      createdBy: user.id,
      assignedTo: assignedTo || null,
      dogId: dogId || null,
      customerId: customerId || null,
      litterId: litterId || null,
    },
    include: {
      assignee: { select: { id: true, firstName: true, lastName: true } },
      creator: { select: { id: true, firstName: true, lastName: true } },
      dog: { select: { id: true, name: true, breed: { select: { name: true } } } },
      customer: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  res.status(201).json({ task });
});

// Update task
export const updateTask = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;
  const updateData = req.body;

  const task = await prisma.task.findUnique({
    where: { id },
    include: { kennel: true },
  });

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // Access control
  if (user.role === 'BREEDER' && task.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (user.role === 'VETERINARIAN') {
    const vet = await prisma.veterinarian.findUnique({ where: { userId: user.id } });
    const isAssigned = await prisma.kennelVet.findUnique({
      where: { kennelId_vetId: { kennelId: task.kennelId, vetId: vet?.id || '' } },
    });
    if (!isAssigned) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  const data: any = {};

  if (updateData.title !== undefined) data.title = updateData.title;
  if (updateData.description !== undefined) data.description = updateData.description;
  if (updateData.status !== undefined) data.status = updateData.status;
  if (updateData.priority !== undefined) data.priority = updateData.priority;
  if (updateData.dueDate !== undefined) data.dueDate = updateData.dueDate ? new Date(updateData.dueDate) : null;
  if (updateData.tags !== undefined) data.tags = updateData.tags;
  if (updateData.recurrenceRule !== undefined) data.recurrenceRule = updateData.recurrenceRule;
  if (updateData.isTemplate !== undefined) data.isTemplate = updateData.isTemplate;
  if (updateData.assignedTo !== undefined) data.assignedTo = updateData.assignedTo || null;
  if (updateData.dogId !== undefined) data.dogId = updateData.dogId || null;
  if (updateData.customerId !== undefined) data.customerId = updateData.customerId || null;
  if (updateData.litterId !== undefined) data.litterId = updateData.litterId || null;

  // Validate dog belongs to kennel if provided
  if (data.dogId) {
    const dog = await prisma.dog.findUnique({ where: { id: data.dogId } });
    if (!dog || dog.kennelId !== task.kennelId) {
      return res.status(400).json({ error: 'Invalid dog selection' });
    }
  }

  // Validate customer belongs to kennel if provided
  if (data.customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
    if (!customer || customer.kennelId !== task.kennelId) {
      return res.status(400).json({ error: 'Invalid customer selection' });
    }
  }

  const updatedTask = await prisma.task.update({
    where: { id },
    data,
    include: {
      assignee: { select: { id: true, firstName: true, lastName: true } },
      creator: { select: { id: true, firstName: true, lastName: true } },
      dog: { select: { id: true, name: true, breed: { select: { name: true } } } },
      customer: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  res.json({ task: updatedTask });
});

// Update task status
export const updateTaskStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const user = req.user!;

  const task = await prisma.task.findUnique({
    where: { id },
    include: { kennel: true },
  });

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  if (user.role === 'BREEDER' && task.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (user.role === 'VETERINARIAN') {
    const vet = await prisma.veterinarian.findUnique({ where: { userId: user.id } });
    const isAssigned = await prisma.kennelVet.findUnique({
      where: { kennelId_vetId: { kennelId: task.kennelId, vetId: vet?.id || '' } },
    });
    if (!isAssigned) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  const updatedTask = await prisma.task.update({
    where: { id },
    data: { status },
    select: { id: true, title: true, status: true },
  });

  res.json({ message: `Task is now ${status.toLowerCase()}`, task: updatedTask });
});

// Delete task
export const deleteTask = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const task = await prisma.task.findUnique({
    where: { id },
    include: { kennel: true },
  });

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  if (user.role === 'BREEDER' && task.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (user.role === 'VETERINARIAN') {
    const vet = await prisma.veterinarian.findUnique({ where: { userId: user.id } });
    const isAssigned = await prisma.kennelVet.findUnique({
      where: { kennelId_vetId: { kennelId: task.kennelId, vetId: vet?.id || '' } },
    });
    if (!isAssigned) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  await prisma.task.delete({ where: { id } });

  res.json({ message: 'Task deleted successfully' });
});

// Get task stats
export const getTaskStats = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId } = req.params;
  const user = req.user!;

  // Access control
  if (user.role === 'BREEDER') {
    const kennel = await prisma.kennel.findUnique({ where: { id: kennelId } });
    if (!kennel || kennel.breederId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  if (user.role === 'VETERINARIAN') {
    const vet = await prisma.veterinarian.findUnique({ where: { userId: user.id } });
    const isAssigned = await prisma.kennelVet.findUnique({
      where: { kennelId_vetId: { kennelId, vetId: vet?.id || '' } },
    });
    if (!isAssigned) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  const where = { kennelId, isTemplate: false };

  const [total, pending, inProgress, completed, cancelled, overdue] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.count({ where: { ...where, status: 'PENDING' } }),
    prisma.task.count({ where: { ...where, status: 'IN_PROGRESS' } }),
    prisma.task.count({ where: { ...where, status: 'COMPLETED' } }),
    prisma.task.count({ where: { ...where, status: 'CANCELLED' } }),
    prisma.task.count({
      where: {
        ...where,
        status: { not: 'COMPLETED' },
        dueDate: { lt: new Date() },
      },
    }),
  ]);

  res.json({ stats: { total, pending, inProgress, completed, cancelled, overdue } });
});

// Get task templates
export const getTaskTemplates = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId } = req.query;
  const user = req.user!;

  const where: any = { isTemplate: true };
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

  const templates = await prisma.task.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      priority: true,
      tags: true,
      recurrenceRule: true,
      kennelId: true,
    },
  });

  res.json({ templates });
});

// Create tasks from template
export const createTasksFromTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { templateId, kennelId } = req.body;
  const user = req.user!;

  // Check access to kennel
  if (user.role === 'BREEDER') {
    const kennel = await prisma.kennel.findUnique({ where: { id: kennelId } });
    if (!kennel || kennel.breederId !== user.id) {
      return res.status(403).json({ error: 'Access denied to this kennel' });
    }
  }

  if (user.role === 'VETERINARIAN') {
    const vet = await prisma.veterinarian.findUnique({ where: { userId: user.id } });
    const isAssigned = await prisma.kennelVet.findUnique({
      where: { kennelId_vetId: { kennelId, vetId: vet?.id || '' } },
    });
    if (!isAssigned) {
      return res.status(403).json({ error: 'Access denied to this kennel' });
    }
  }

  const template = await prisma.task.findUnique({ where: { id: templateId } });

  if (!template || !template.isTemplate) {
    return res.status(404).json({ error: 'Template not found' });
  }

  if (template.kennelId !== kennelId) {
    return res.status(403).json({ error: 'Template does not belong to this kennel' });
  }

  const task = await prisma.task.create({
    data: {
      title: template.title,
      description: template.description,
      status: 'PENDING',
      priority: template.priority,
      tags: template.tags,
      recurrenceRule: template.recurrenceRule,
      isTemplate: false,
      kennelId,
      createdBy: user.id,
    },
    include: {
      assignee: { select: { id: true, firstName: true, lastName: true } },
      creator: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  res.status(201).json({ tasksCreated: 1, task });
});
