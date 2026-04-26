import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
import { sendWelcomeEmail } from '../utils/email';

// List all users (Manager only)
export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { role, status, search } = req.query;

  const where: any = {};

  if (role) where.role = role;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { firstName: { contains: search as string, mode: 'insensitive' } },
      { lastName: { contains: search as string, mode: 'insensitive' } },
      { email: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      avatarUrl: true,
      phone: true,
      createdAt: true,
      lastLogin: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ users });
});

// Get user by ID
export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      avatarUrl: true,
      phone: true,
      createdAt: true,
      lastLogin: true,
      kennel: {
        select: {
          id: true,
          name: true,
        },
      },
      veterinarian: {
        select: {
          id: true,
          license: true,
          specialization: true,
          kennels: {
            select: {
              kennel: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ user });
});

// Create user (Manager only)
export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const { email, firstName, lastName, role, phone, kennelIds, vetData } = req.body;

  // Check if email exists
  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    return res.status(409).json({ error: 'User with this email already exists' });
  }

  // Generate temporary password
  const tempPassword = crypto.randomBytes(8).toString('hex');
  const hashedPassword = await bcrypt.hash(tempPassword, 12);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role,
      phone,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
    },
  });

  // If breeder, create a kennel automatically
  if (role === 'BREEDER') {
    const baseSlug = `${firstName}-criadero`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    let slug = baseSlug;
    let counter = 1;
    let existingSlug = await prisma.kennel.findUnique({ where: { slug } });
    while (existingSlug) {
      slug = `${baseSlug}-${counter}`;
      existingSlug = await prisma.kennel.findUnique({ where: { slug } });
      counter++;
    }

    await prisma.kennel.create({
      data: {
        name: `Criadero de ${firstName}`,
        slug,
        breederId: user.id,
        status: 'ACTIVE',
        isPublic: true,
      },
    });
  }

  // If veterinarian, create vet record and assign to kennels
  if (role === 'VETERINARIAN') {
    const vet = await prisma.veterinarian.create({
      data: {
        userId: user.id,
        license: vetData?.license,
        specialization: vetData?.specialization,
      },
    });

    if (kennelIds?.length) {
      await prisma.kennelVet.createMany({
        data: kennelIds.map((kennelId: string) => ({
          kennelId,
          vetId: vet.id,
        })),
      });
    }
  }

  // Send welcome email with temp password
  await sendWelcomeEmail(email, `${firstName} ${lastName}`, tempPassword);

  res.status(201).json({
    message: 'User created successfully',
    user,
    tempPassword, // Only shown once
  });
});

// Update user
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { firstName, lastName, phone, status, vetData } = req.body;

  const user = await prisma.user.findUnique({
    where: { id },
    include: { veterinarian: true },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Update basic info
  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      firstName,
      lastName,
      phone,
      status,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      avatarUrl: true,
      phone: true,
    },
  });

  // Update vet info
  if (user.role === 'VETERINARIAN' && user.veterinarian) {
    if (vetData) {
      await prisma.veterinarian.update({
        where: { id: user.veterinarian.id },
        data: {
          license: vetData.license,
          specialization: vetData.specialization,
        },
      });
    }
  }

  res.json({ user: updatedUser });
});

// Toggle user status (activate/deactivate)
export const toggleUserStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

  await prisma.user.update({
    where: { id },
    data: { status: newStatus },
  });

  res.json({ message: `User ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}`, status: newStatus });
});

// Delete user
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  // Don't allow deleting yourself
  if (req.user?.id === id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  await prisma.user.delete({
    where: { id },
  });

  res.json({ message: 'User deleted successfully' });
});

// Get vets for assignment
export const getVeterinarians = asyncHandler(async (req: Request, res: Response) => {
  const vets = await prisma.veterinarian.findMany({
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
  });

  res.json({ veterinarians: vets });
});
