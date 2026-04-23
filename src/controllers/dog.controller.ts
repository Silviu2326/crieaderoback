import { Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
type DogStatus = string;
type DogVisibility = string;

// List dogs
export const listDogs = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, search, status, gender, breedId, visibility, birthDateFrom, birthDateTo, fatherId, motherId } = req.query;
  const user = req.user!;

  const where: any = {};

  if (kennelId) where.kennelId = kennelId as string;
  if (status) where.status = status as DogStatus;
  if (gender) where.gender = gender as 'MALE' | 'FEMALE';
  if (breedId) where.breedId = breedId as string;
  if (visibility) where.visibility = visibility as DogVisibility;
  if (fatherId) where.fatherId = fatherId as string;
  if (motherId) where.motherId = motherId as string;

  if (birthDateFrom || birthDateTo) {
    where.birthDate = {};
    if (birthDateFrom) where.birthDate.gte = new Date(birthDateFrom as string);
    if (birthDateTo) where.birthDate.lte = new Date(birthDateTo as string);
  }

  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { microchip: { contains: search as string } },
      { pedigree: { contains: search as string } },
    ];
  }

  // Access control
  if (user.role === 'BREEDER') {
    // Breeders see dogs from their kennels
    const myKennels = await prisma.kennel.findMany({
      where: { breederId: user.id },
      select: { id: true },
    });
    const myKennelIds = myKennels.map(k => k.id);

    if (kennelId && !myKennelIds.includes(kennelId as string)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!kennelId) {
      where.kennelId = { in: myKennelIds };
    }
  } else if (user.role === 'VETERINARIAN') {
    // Vets see dogs from assigned kennels
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

  const dogs = await prisma.dog.findMany({
    where,
    include: {
      breed: {
        select: { id: true, name: true },
      },
      kennel: {
        select: { id: true, name: true },
      },
      photos: {
        where: { isMain: true },
        take: 1,
        select: { url: true },
      },
      father: {
        select: { id: true, name: true },
      },
      mother: {
        select: { id: true, name: true },
      },
      _count: {
        select: {
          medicalRecords: true,
          reservations: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ dogs });
});

// Get single dog
export const getDog = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const dog = await prisma.dog.findUnique({
    where: { id },
    include: {
      breed: true,
      kennel: {
        select: {
          id: true,
          name: true,
          breederId: true,
        },
      },
      photos: {
        orderBy: { order: 'asc' },
      },
      father: {
        include: {
          breed: { select: { name: true } },
          photos: { where: { isMain: true }, take: 1 },
        },
      },
      mother: {
        include: {
          breed: { select: { name: true } },
          photos: { where: { isMain: true }, take: 1 },
        },
      },
      childrenFather: {
        select: {
          id: true,
          name: true,
          gender: true,
          birthDate: true,
          breed: { select: { name: true } },
          photos: { where: { isMain: true }, take: 1 },
        },
      },
      childrenMother: {
        select: {
          id: true,
          name: true,
          gender: true,
          birthDate: true,
          breed: { select: { name: true } },
          photos: { where: { isMain: true }, take: 1 },
        },
      },
      medicalRecords: {
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
      },
      reservations: {
        include: {
          customer: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      motherLitters: {
        include: {
          father: { select: { name: true } },
        },
        orderBy: { birthDate: 'desc' },
      },
      fatherLitters: {
        include: {
          mother: { select: { name: true } },
        },
        orderBy: { birthDate: 'desc' },
      },
    },
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
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  res.json({ dog });
});

// Create dog
export const createDog = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const {
    name,
    breedId,
    gender,
    birthDate,
    color,
    microchip,
    pedigree,
    price,
    status,
    visibility,
    internalNotes,
    kennelId,
    fatherId,
    motherId,
    photos,
  } = req.body;

  // Check access to kennel
  if (user.role === 'BREEDER') {
    const kennel = await prisma.kennel.findUnique({
      where: { id: kennelId },
    });
    if (!kennel || kennel.breederId !== user.id) {
      return res.status(403).json({ error: 'Access denied to this kennel' });
    }
  }

  // Validate father/mother are from same kennel
  if (fatherId) {
    const father = await prisma.dog.findUnique({ where: { id: fatherId } });
    if (!father || father.kennelId !== kennelId || father.gender !== 'MALE') {
      return res.status(400).json({ error: 'Invalid father selection' });
    }
  }

  if (motherId) {
    const mother = await prisma.dog.findUnique({ where: { id: motherId } });
    if (!mother || mother.kennelId !== kennelId || mother.gender !== 'FEMALE') {
      return res.status(400).json({ error: 'Invalid mother selection' });
    }
  }

  // Create dog
  const dog = await prisma.dog.create({
    data: {
      name,
      breedId,
      gender,
      birthDate: new Date(birthDate),
      color,
      microchip,
      pedigree,
      price: price !== undefined ? parseFloat(price) : undefined,
      status: status || 'AVAILABLE',
      visibility: visibility || 'PRIVATE',
      internalNotes,
      kennelId,
      fatherId,
      motherId,
      photos: photos?.length ? {
        create: photos.map((url: string, index: number) => ({
          url,
          isMain: index === 0,
          order: index,
        })),
      } : undefined,
    },
    include: {
      breed: { select: { name: true } },
      photos: true,
      father: { select: { name: true } },
      mother: { select: { name: true } },
    },
  });

  res.status(201).json({ dog });
});

// Update dog
export const updateDog = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;
  const updateData = req.body;

  const dog = await prisma.dog.findUnique({
    where: { id },
    include: { kennel: true },
  });

  if (!dog) {
    return res.status(404).json({ error: 'Dog not found' });
  }

  // Check access
  if (user.role === 'BREEDER' && dog.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Vets can only update medical info via medical records
  if (user.role === 'VETERINARIAN') {
    return res.status(403).json({ error: 'Veterinarians cannot modify dog details' });
  }

  // Check active reservation if trying to mark as available
  if (updateData.status === 'AVAILABLE' && dog.status !== 'AVAILABLE') {
    const activeReservation = await prisma.reservation.findFirst({
      where: {
        dogId: id,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });
    if (activeReservation) {
      return res.status(400).json({
        error: 'Cannot mark as available while there is an active reservation. Cancel the reservation first.'
      });
    }
  }

  // Validate visibility change
  if (updateData.visibility === 'PUBLIC') {
    // Must have at least one photo and breed defined
    const photoCount = await prisma.dogPhoto.count({ where: { dogId: id } });
    if (!photoCount) {
      return res.status(400).json({ error: 'Dog must have at least one photo to be public' });
    }
    if (!dog.breedId) {
      return res.status(400).json({ error: 'Dog must have a breed defined to be public' });
    }
  }

  const data: any = {};

  if (updateData.name) data.name = updateData.name;
  if (updateData.breedId) data.breedId = updateData.breedId;
  if (updateData.gender) data.gender = updateData.gender;
  if (updateData.birthDate) data.birthDate = new Date(updateData.birthDate);
  if (updateData.color !== undefined) data.color = updateData.color;
  if (updateData.microchip !== undefined) data.microchip = updateData.microchip;
  if (updateData.pedigree !== undefined) data.pedigree = updateData.pedigree;
  if (updateData.price !== undefined) data.price = updateData.price !== null && updateData.price !== '' ? parseFloat(updateData.price) : null;
  if (updateData.status) data.status = updateData.status;
  if (updateData.visibility) data.visibility = updateData.visibility;
  if (updateData.internalNotes !== undefined) data.internalNotes = updateData.internalNotes;
  if (updateData.fatherId !== undefined) data.fatherId = updateData.fatherId || null;
  if (updateData.motherId !== undefined) data.motherId = updateData.motherId || null;

  const updatedDog = await prisma.dog.update({
    where: { id },
    data,
    include: {
      breed: { select: { name: true } },
      photos: { orderBy: { order: 'asc' } },
      father: { select: { name: true } },
      mother: { select: { name: true } },
    },
  });

  res.json({ dog: updatedDog });
});

// Toggle visibility
export const toggleVisibility = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const dog = await prisma.dog.findUnique({
    where: { id },
    include: { kennel: true, photos: true },
  });

  if (!dog) {
    return res.status(404).json({ error: 'Dog not found' });
  }

  if (user.role === 'BREEDER' && dog.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const newVisibility = dog.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC';

  // Validate if trying to make public
  if (newVisibility === 'PUBLIC') {
    if (!dog.photos.length) {
      return res.status(400).json({ error: 'Dog must have at least one photo to be public' });
    }
    if (!dog.breedId) {
      return res.status(400).json({ error: 'Dog must have a breed defined to be public' });
    }
  }

  const updatedDog = await prisma.dog.update({
    where: { id },
    data: { visibility: newVisibility },
    select: { id: true, name: true, visibility: true },
  });

  res.json({
    message: `Dog is now ${newVisibility.toLowerCase()}`,
    dog: updatedDog
  });
});

// Delete dog
export const deleteDog = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const dog = await prisma.dog.findUnique({
    where: { id },
    include: { kennel: true },
  });

  if (!dog) {
    return res.status(404).json({ error: 'Dog not found' });
  }

  if (user.role === 'BREEDER' && dog.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Check for active reservations
  const activeReservation = await prisma.reservation.findFirst({
    where: {
      dogId: id,
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
  });

  if (activeReservation) {
    return res.status(400).json({
      error: 'Cannot delete dog with active reservations. Cancel them first.'
    });
  }

  await prisma.dog.delete({ where: { id } });

  res.json({ message: 'Dog deleted successfully' });
});

// Add photos
export const addPhotos = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { urls } = req.body;
  const user = req.user!;

  const dog = await prisma.dog.findUnique({
    where: { id },
    include: { kennel: true },
  });

  if (!dog) {
    return res.status(404).json({ error: 'Dog not found' });
  }

  if (user.role === 'BREEDER' && dog.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const currentPhotoCount = await prisma.dogPhoto.count({ where: { dogId: id } });

  if (currentPhotoCount + urls.length > 10) {
    return res.status(400).json({ error: 'Maximum 10 photos allowed per dog' });
  }

  const photos = await prisma.$transaction(
    urls.map((url: string, index: number) =>
      prisma.dogPhoto.create({
        data: {
          url,
          dogId: id,
          order: currentPhotoCount + index,
          isMain: currentPhotoCount === 0 && index === 0,
        },
      })
    )
  );

  res.status(201).json({ photos });
});

// Remove photo
export const removePhoto = asyncHandler(async (req: Request, res: Response) => {
  const { id, photoId } = req.params;
  const user = req.user!;

  const dog = await prisma.dog.findUnique({
    where: { id },
    include: { kennel: true },
  });

  if (!dog) {
    return res.status(404).json({ error: 'Dog not found' });
  }

  if (user.role === 'BREEDER' && dog.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.dogPhoto.delete({
    where: { id: photoId, dogId: id },
  });

  res.json({ message: 'Photo removed' });
});

// Set main photo
export const setMainPhoto = asyncHandler(async (req: Request, res: Response) => {
  const { id, photoId } = req.params;
  const user = req.user!;

  const dog = await prisma.dog.findUnique({
    where: { id },
    include: { kennel: true },
  });

  if (!dog) {
    return res.status(404).json({ error: 'Dog not found' });
  }

  if (user.role === 'BREEDER' && dog.kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.$transaction([
    prisma.dogPhoto.updateMany({
      where: { dogId: id },
      data: { isMain: false },
    }),
    prisma.dogPhoto.update({
      where: { id: photoId },
      data: { isMain: true },
    }),
  ]);

  res.json({ message: 'Main photo updated' });
});

async function buildPedigreeNode(
  dogId: string,
  generation: number,
  maxGeneration: number
): Promise<any> {
  if (generation > maxGeneration) return null;

  const dog = await prisma.dog.findUnique({
    where: { id: dogId },
    include: {
      breed: { select: { name: true } },
      father: true,
      mother: true,
    },
  });

  if (!dog) return null;

  const [father, mother] = await Promise.all([
    dog.fatherId ? buildPedigreeNode(dog.fatherId, generation + 1, maxGeneration) : undefined,
    dog.motherId ? buildPedigreeNode(dog.motherId, generation + 1, maxGeneration) : undefined,
  ]);

  return {
    id: `${dog.id}-g${generation}`,
    dog: {
      id: dog.id,
      name: dog.name,
      breed: dog.breed ? { name: dog.breed.name } : undefined,
    },
    generation,
    father,
    mother,
  };
}

// Get dog pedigree tree
export const getPedigree = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const dog = await prisma.dog.findUnique({
    where: { id },
    select: {
      kennelId: true,
      kennel: { select: { breederId: true } },
    },
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
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  const MAX_GENERATION = 2; // perro + padres + abuelos
  const pedigree = await buildPedigreeNode(id, 0, MAX_GENERATION);
  res.json({ pedigree });
});

// Get available parents for breeding
export const getAvailableParents = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, gender } = req.query;
  const user = req.user!;

  if (!kennelId) {
    return res.status(400).json({ error: 'Kennel ID required' });
  }

  // Check access
  if (user.role === 'BREEDER') {
    const kennel = await prisma.kennel.findUnique({
      where: { id: kennelId as string },
    });
    if (!kennel || kennel.breederId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  const dogs = await prisma.dog.findMany({
    where: {
      kennelId: kennelId as string,
      gender: gender as 'MALE' | 'FEMALE',
      status: { not: 'SOLD' },
    },
    select: {
      id: true,
      name: true,
      birthDate: true,
      breed: { select: { name: true } },
      photos: { where: { isMain: true }, take: 1 },
    },
    orderBy: { name: 'asc' },
  });

  res.json({ dogs });
});
