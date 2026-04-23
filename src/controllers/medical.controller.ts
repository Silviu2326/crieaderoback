import { Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Get medical records for a dog
export const getDogMedicalRecords = asyncHandler(async (req: Request, res: Response) => {
  const { dogId } = req.params;
  const user = req.user!;

  const dog = await prisma.dog.findUnique({
    where: { id: dogId },
    include: { kennel: true },
  });

  if (!dog) {
    return res.status(404).json({ error: 'Dog not found' });
  }

  // Access control
  if (user.role === 'BREEDER' && dog.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (user.role === 'VETERINARIAN') {
    const vet = await prisma.veterinarian.findUnique({
      where: { userId: user.id },
    });
    const isAssigned = await prisma.kennelVet.findUnique({
      where: {
        kennelId_vetId: {
          kennelId: dog.kennelId,
          vetId: vet?.id || '',
        },
      },
    });
    if (!isAssigned) {
      return res.status(403).json({ error: 'Not assigned to this kennel' });
    }
  }

  const records = await prisma.medicalRecord.findMany({
    where: { dogId },
    include: {
      vet: {
        include: {
          user: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
    orderBy: { date: 'desc' },
  });

  res.json({ records });
});

// Get single medical record
export const getMedicalRecord = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const record = await prisma.medicalRecord.findUnique({
    where: { id },
    include: {
      dog: {
        include: { kennel: true },
      },
      vet: {
        include: {
          user: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
  });

  if (!record) {
    return res.status(404).json({ error: 'Medical record not found' });
  }

  // Access control
  if (user.role === 'BREEDER' && record.dog.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (user.role === 'VETERINARIAN') {
    const vet = await prisma.veterinarian.findUnique({
      where: { userId: user.id },
    });
    const isAssigned = await prisma.kennelVet.findUnique({
      where: {
        kennelId_vetId: {
          kennelId: record.dog.kennelId,
          vetId: vet?.id || '',
        },
      },
    });
    if (!isAssigned) {
      return res.status(403).json({ error: 'Not assigned to this kennel' });
    }
  }

  res.json({ record });
});

// Create medical record (Vets and Managers only)
export const createMedicalRecord = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const { dogId, type, date, description, nextDate, attachmentUrl, ...specificData } = req.body;

  const dog = await prisma.dog.findUnique({
    where: { id: dogId },
    include: { kennel: true },
  });

  if (!dog) {
    return res.status(404).json({ error: 'Dog not found' });
  }

  // Get vet ID
  let vetId: string;

  if (user.role === 'VETERINARIAN') {
    const vet = await prisma.veterinarian.findUnique({
      where: { userId: user.id },
    });
    if (!vet) {
      return res.status(403).json({ error: 'Veterinarian profile not found' });
    }

    // Check assignment
    const isAssigned = await prisma.kennelVet.findUnique({
      where: {
        kennelId_vetId: {
          kennelId: dog.kennelId,
          vetId: vet.id,
        },
      },
    });

    if (!isAssigned) {
      return res.status(403).json({ error: 'Not assigned to this kennel' });
    }

    vetId = vet.id;
  } else if (user.role === 'MANAGER') {
    // Managers can create records, but need to specify vetId or use a default
    const vets = await prisma.veterinarian.findMany({ take: 1 });
    if (!vets.length) {
      return res.status(400).json({ error: 'No veterinarians available' });
    }
    vetId = vets[0].id;
  } else {
    return res.status(403).json({ error: 'Only vets and managers can create medical records' });
  }

  const record = await prisma.medicalRecord.create({
    data: {
      dogId,
      type,
      date: new Date(date),
      description,
      nextDate: nextDate ? new Date(nextDate) : null,
      attachmentUrl,
      vetId,
      createdBy: user.id,
      // Type-specific fields
      vaccineName: specificData.vaccineName,
      vaccineLot: specificData.vaccineLot,
      vaccineLab: specificData.vaccineLab,
      dewormerProduct: specificData.dewormerProduct,
      weightAtDate: specificData.weightAtDate,
      diagnosis: specificData.diagnosis,
      treatment: specificData.treatment,
      postOpNotes: specificData.postOpNotes,
    },
    include: {
      vet: {
        include: {
          user: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
  });

  res.status(201).json({ record });
});

// Update medical record
export const updateMedicalRecord = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;
  const updateData = req.body;

  const record = await prisma.medicalRecord.findUnique({
    where: { id },
    include: {
      dog: { include: { kennel: true } },
    },
  });

  if (!record) {
    return res.status(404).json({ error: 'Medical record not found' });
  }

  // Only the creator or manager can update
  if (user.role === 'VETERINARIAN' && record.createdBy !== user.id) {
    return res.status(403).json({ error: 'Can only edit your own records' });
  }

  const updatedRecord = await prisma.medicalRecord.update({
    where: { id },
    data: {
      type: updateData.type,
      date: updateData.date ? new Date(updateData.date) : undefined,
      description: updateData.description,
      nextDate: updateData.nextDate ? new Date(updateData.nextDate) : null,
      attachmentUrl: updateData.attachmentUrl,
      vaccineName: updateData.vaccineName,
      vaccineLot: updateData.vaccineLot,
      vaccineLab: updateData.vaccineLab,
      dewormerProduct: updateData.dewormerProduct,
      weightAtDate: updateData.weightAtDate,
      diagnosis: updateData.diagnosis,
      treatment: updateData.treatment,
      postOpNotes: updateData.postOpNotes,
    },
    include: {
      vet: {
        include: {
          user: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
  });

  res.json({ record: updatedRecord });
});

// Delete medical record
export const deleteMedicalRecord = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const record = await prisma.medicalRecord.findUnique({
    where: { id },
    include: { dog: { include: { kennel: true } } },
  });

  if (!record) {
    return res.status(404).json({ error: 'Medical record not found' });
  }

  // Only creator, manager, or kennel breeder can delete
  if (user.role === 'VETERINARIAN' && record.createdBy !== user.id) {
    return res.status(403).json({ error: 'Can only delete your own records' });
  }

  if (user.role === 'BREEDER' && record.dog.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.medicalRecord.delete({ where: { id } });

  res.json({ message: 'Medical record deleted' });
});

// Upload attachment for medical record
const UPLOAD_DIR = path.join(__dirname, '../../uploads/medical');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export const uploadMedicalAttachment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const file = req.file;
  const fileExtension = path.extname(file.originalname);
  const fileName = `${uuidv4()}${fileExtension}`;
  const filePath = path.join(UPLOAD_DIR, fileName);

  fs.writeFileSync(filePath, file.buffer);

  res.json({
    url: `/uploads/medical/${fileName}`,
    fileName: file.originalname,
    fileSize: file.size,
    mimeType: file.mimetype,
  });
});

// Get upcoming vaccines (alert dashboard)
export const getUpcomingAlerts = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const { kennelId } = req.query;

  const where: any = {
    nextDate: {
      gte: new Date(),
      lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Next 30 days
    },
  };

  // Access control
  if (user.role === 'BREEDER') {
    const myKennels = await prisma.kennel.findMany({
      where: { breederId: user.id },
      select: { id: true },
    });
    const myKennelIds = myKennels.map(k => k.id);

    if (kennelId && !myKennelIds.includes(kennelId as string)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    where.dog = { kennelId: kennelId ? (kennelId as string) : { in: myKennelIds } };
  } else if (user.role === 'VETERINARIAN') {
    const vet = await prisma.veterinarian.findUnique({
      where: { userId: user.id },
      include: { kennels: { select: { kennelId: true } } },
    });

    const assignedKennelIds = vet?.kennels.map(k => k.kennelId) || [];

    if (kennelId && !assignedKennelIds.includes(kennelId as string)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    where.dog = { kennelId: kennelId ? (kennelId as string) : { in: assignedKennelIds } };
  }

  const alerts = await prisma.medicalRecord.findMany({
    where,
    include: {
      dog: {
        select: {
          id: true,
          name: true,
          kennel: { select: { name: true } },
        },
      },
    },
    orderBy: { nextDate: 'asc' },
    take: 50,
  });

  res.json({ alerts });
});
