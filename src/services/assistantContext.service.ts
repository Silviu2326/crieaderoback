import prisma from '../config/database';
import type { DogContext } from '../types/assistant';

export async function buildDogContext(dogId: string, userKennelId: string): Promise<DogContext | null> {
  const dog = await prisma.dog.findFirst({
    where: {
      id: dogId,
      kennelId: userKennelId,
    },
    include: {
      breed: true,
      photos: { where: { isMain: true }, take: 1 },
      medicalRecords: {
        orderBy: { date: 'desc' },
        take: 10,
        include: { vet: { include: { user: true } } },
      },
      supplements: { where: { endDate: null } },
      foodIntolerances: { where: { isActive: true } },
      calendarEvents: {
        where: { date: { gte: new Date() } },
        orderBy: { date: 'asc' },
        take: 5,
      },
      geneticTests: { orderBy: { testDate: 'desc' }, take: 5 },
    },
  });

  if (!dog) return null;

  const now = new Date();
  const birthDate = new Date(dog.birthDate);
  const ageMonths = (now.getFullYear() - birthDate.getFullYear()) * 12 + (now.getMonth() - birthDate.getMonth());
  const ageYears = Math.floor(ageMonths / 12);
  const remainingMonths = ageMonths % 12;

  let ageText: string;
  if (ageYears > 0 && remainingMonths > 0) {
    ageText = `${ageYears} año${ageYears > 1 ? 's' : ''} ${remainingMonths} mes${remainingMonths > 1 ? 'es' : ''}`;
  } else if (ageYears > 0) {
    ageText = `${ageYears} año${ageYears > 1 ? 's' : ''}`;
  } else {
    ageText = `${ageMonths} mes${ageMonths > 1 ? 'es' : ''}`;
  }

  return {
    id: dog.id,
    name: dog.name,
    breed: dog.breed.name,
    gender: dog.gender === 'MALE' ? 'Macho' : 'Hembra',
    age: ageText,
    color: dog.color || undefined,
    status: dog.status,
    microchip: dog.microchip || undefined,
    recentMedicalRecords: dog.medicalRecords.map((r) => ({
      type: r.type,
      date: r.date.toISOString().split('T')[0],
      description: r.description,
      diagnosis: r.diagnosis || undefined,
      treatment: r.treatment || undefined,
      nextDate: r.nextDate ? r.nextDate.toISOString().split('T')[0] : undefined,
    })),
    activeSupplements: dog.supplements.map((s) => ({
      name: s.name,
      dosage: s.dosage,
      frequency: s.frequency,
    })),
    foodIntolerances: dog.foodIntolerances.map((i) => ({
      foodName: i.foodName,
      severity: i.severity,
      symptoms: i.symptoms || undefined,
    })),
    upcomingEvents: dog.calendarEvents.map((e) => ({
      title: e.title,
      type: e.type,
      date: e.date.toISOString().split('T')[0],
    })),
    geneticTests: dog.geneticTests.map((t) => ({
      testName: t.testName,
      result: t.result,
      testDate: t.testDate.toISOString().split('T')[0],
    })),
  };
}
