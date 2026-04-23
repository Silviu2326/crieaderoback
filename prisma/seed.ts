import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const FCI_BREEDS = [
  { name: 'Labrador Retriever', group: 'Retrievers', origin: 'United Kingdom' },
  { name: 'German Shepherd', group: 'Sheepdogs', origin: 'Germany' },
  { name: 'Golden Retriever', group: 'Retrievers', origin: 'United Kingdom' },
  { name: 'French Bulldog', group: 'Companion Dogs', origin: 'France' },
  { name: 'Bulldog', group: 'Molossians', origin: 'United Kingdom' },
  { name: 'Poodle', group: 'Companion Dogs', origin: 'Germany/France' },
  { name: 'Beagle', group: 'Scent Hounds', origin: 'United Kingdom' },
  { name: 'Rottweiler', group: 'Molossians', origin: 'Germany' },
  { name: 'Yorkshire Terrier', group: 'Toy Dogs', origin: 'United Kingdom' },
  { name: 'Dachshund', group: 'Scent Hounds', origin: 'Germany' },
  { name: 'Boxer', group: 'Molossians', origin: 'Germany' },
  { name: 'Siberian Husky', group: 'Nordic Sled Dogs', origin: 'Russia' },
  { name: 'Chihuahua', group: 'Toy Dogs', origin: 'Mexico' },
  { name: 'Pomeranian', group: 'Spitz', origin: 'Germany/Poland' },
  { name: 'Shih Tzu', group: 'Companion Dogs', origin: 'China' },
  { name: 'Doberman Pinscher', group: 'Pinschers', origin: 'Germany' },
  { name: 'Great Dane', group: 'Molossians', origin: 'Germany' },
  { name: 'Border Collie', group: 'Sheepdogs', origin: 'United Kingdom' },
  { name: 'Australian Shepherd', group: 'Sheepdogs', origin: 'United States' },
  { name: 'Cocker Spaniel', group: 'Spaniels', origin: 'United Kingdom' },
  { name: 'Pug', group: 'Companion Dogs', origin: 'China' },
  { name: 'Maltese', group: 'Toy Dogs', origin: 'Malta' },
  { name: 'Bernese Mountain Dog', group: 'Mountain Dogs', origin: 'Switzerland' },
  { name: 'Shiba Inu', group: 'Spitz', origin: 'Japan' },
  { name: 'Bichon Frise', group: 'Companion Dogs', origin: 'France' },
];

async function main() {
  console.log('🌱 Seeding database...\n');

  // Create breeds
  console.log('Creating breeds...');
  for (const breed of FCI_BREEDS) {
    await prisma.breed.upsert({
      where: { name: breed.name },
      update: {},
      create: breed,
    });
  }
  console.log(`  ✓ ${FCI_BREEDS.length} breeds created`);

  // Create Manager user with more complete data
  console.log('\nCreating users...');
  const managerPassword = await bcrypt.hash('Manager123!', 12);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@petwellly.com' },
    update: {},
    create: {
      email: 'manager@petwellly.com',
      password: managerPassword,
      firstName: 'Carlos',
      lastName: 'Rodríguez Martínez',
      role: 'MANAGER',
      status: 'ACTIVE',
      phone: '+34 612 345 678',
      avatarUrl: 'https://i.pravatar.cc/150?u=manager',
    },
  });
  console.log(`  ✓ Manager: ${manager.firstName} ${manager.lastName}`);

  // Create Breeder user
  const breederPassword = await bcrypt.hash('Breeder123!', 12);
  const breeder = await prisma.user.upsert({
    where: { email: 'breeder@petwellly.com' },
    update: {},
    create: {
      email: 'breeder@petwellly.com',
      password: breederPassword,
      firstName: 'María',
      lastName: 'García López',
      role: 'BREEDER',
      status: 'ACTIVE',
      phone: '+34 623 456 789',
      avatarUrl: 'https://i.pravatar.cc/150?u=breeder',
    },
  });
  console.log(`  ✓ Breeder: ${breeder.firstName} ${breeder.lastName}`);

  // Create second breeder
  const breeder2Password = await bcrypt.hash('Breeder123!', 12);
  const breeder2 = await prisma.user.upsert({
    where: { email: 'ana@caninepro.es' },
    update: {},
    create: {
      email: 'ana@caninepro.es',
      password: breeder2Password,
      firstName: 'Ana',
      lastName: 'Fernández Silva',
      role: 'BREEDER',
      status: 'ACTIVE',
      phone: '+34 634 567 890',
      avatarUrl: 'https://i.pravatar.cc/150?u=ana',
    },
  });
  console.log(`  ✓ Breeder 2: ${breeder2.firstName} ${breeder2.lastName}`);

  // Create Veterinarian user
  const vetPassword = await bcrypt.hash('Vet123!', 12);
  const vetUser = await prisma.user.upsert({
    where: { email: 'vet@petwellly.com' },
    update: {},
    create: {
      email: 'vet@petwellly.com',
      password: vetPassword,
      firstName: 'Dr. Javier',
      lastName: 'Sánchez Vidal',
      role: 'VETERINARIAN',
      status: 'ACTIVE',
      phone: '+34 645 678 901',
      avatarUrl: 'https://i.pravatar.cc/150?u=vet',
    },
  });

  // Create second veterinarian
  const vet2Password = await bcrypt.hash('Vet123!', 12);
  const vet2User = await prisma.user.upsert({
    where: { email: 'laura@vetcare.es' },
    update: {},
    create: {
      email: 'laura@vetcare.es',
      password: vet2Password,
      firstName: 'Dra. Laura',
      lastName: 'Martín Ruiz',
      role: 'VETERINARIAN',
      status: 'ACTIVE',
      phone: '+34 656 789 012',
      avatarUrl: 'https://i.pravatar.cc/150?u=lauravet',
    },
  });

  // Create Veterinarian profiles
  const vetProfile = await prisma.veterinarian.upsert({
    where: { userId: vetUser.id },
    update: {},
    create: {
      userId: vetUser.id,
      license: 'COV-12345-M',
      specialization: 'Medicina Reproductiva Canina',
    },
  });
  console.log(`  ✓ Veterinarian: ${vetUser.firstName} ${vetUser.lastName}`);

  const vet2Profile = await prisma.veterinarian.upsert({
    where: { userId: vet2User.id },
    update: {},
    create: {
      userId: vet2User.id,
      license: 'COV-67890-F',
      specialization: 'Cirugía y Traumatología',
    },
  });
  console.log(`  ✓ Veterinarian 2: ${vet2User.firstName} ${vet2User.lastName}`);

  // Create Customer users
  const customerPassword = await bcrypt.hash('Customer123!', 12);
  const customerUser = await prisma.user.upsert({
    where: { email: 'customer@petwellly.com' },
    update: {},
    create: {
      email: 'customer@petwellly.com',
      password: customerPassword,
      firstName: 'Juan',
      lastName: 'Pérez González',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      phone: '+34 667 890 123',
      avatarUrl: 'https://i.pravatar.cc/150?u=customer',
    },
  });
  console.log(`  ✓ Customer: ${customerUser.firstName} ${customerUser.lastName}`);

  const customer2Password = await bcrypt.hash('Customer123!', 12);
  const customer2User = await prisma.user.upsert({
    where: { email: 'laura@gmail.com' },
    update: {},
    create: {
      email: 'laura@gmail.com',
      password: customer2Password,
      firstName: 'Laura',
      lastName: 'Gómez Ruiz',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      phone: '+34 678 901 234',
      avatarUrl: 'https://i.pravatar.cc/150?u=laura',
    },
  });
  console.log(`  ✓ Customer 2: ${customer2User.firstName} ${customer2User.lastName}`);

  // Create sample kennels with more complete data
  console.log('\nCreating kennels...');
  const kennel = await prisma.kennel.upsert({
    where: { slug: 'golden-paws' },
    update: {},
    create: {
      name: 'Golden Paws Kennel',
      slug: 'golden-paws',
      description: 'Criadores especializados en Golden Retrievers y Labradors con más de 15 años de experiencia. Nos dedicamos a la cría responsable de perros de raza con excelente temperamento y salud. Todos nuestros ejemplares están certificados por la RSCE y cuentan con todas las pruebas de salud requeridas.',
      address: 'Calle Mayor 123, Local 5',
      city: 'Madrid',
      country: 'España',
      phone: '+34 912 345 678',
      email: 'info@goldenpaws.es',
      website: 'www.goldenpaws.es',
      logoUrl: 'https://via.placeholder.com/200x200?text=Golden+Paws',
      status: 'ACTIVE',
      isPublic: true,
      breederId: breeder.id,
    },
  });
  console.log(`  ✓ Kennel 1: ${kennel.name}`);

  const kennel2 = await prisma.kennel.upsert({
    where: { slug: 'canine-pro' },
    update: {},
    create: {
      name: 'Canine Pro',
      slug: 'canine-pro',
      description: 'Especialistas en razas de trabajo: Pastores Alemanes, Dobermans y Rottweilers. Criadores con enfoque en perros de protección y deporte canino. Instalaciones de 2000m² con áreas de entrenamiento y socialización.',
      address: 'Avenida de la Constitución 456',
      city: 'Barcelona',
      country: 'España',
      phone: '+34 934 567 890',
      email: 'contacto@caninepro.es',
      website: 'www.caninepro.es',
      logoUrl: 'https://via.placeholder.com/200x200?text=Canine+Pro',
      status: 'ACTIVE',
      isPublic: true,
      breederId: breeder2.id,
    },
  });
  console.log(`  ✓ Kennel 2: ${kennel2.name}`);

  // Assign vets to kennels
  await prisma.kennelVet.upsert({
    where: {
      kennelId_vetId: {
        kennelId: kennel.id,
        vetId: vetProfile.id,
      },
    },
    update: {},
    create: {
      kennelId: kennel.id,
      vetId: vetProfile.id,
    },
  });

  await prisma.kennelVet.upsert({
    where: {
      kennelId_vetId: {
        kennelId: kennel2.id,
        vetId: vet2Profile.id,
      },
    },
    update: {},
    create: {
      kennelId: kennel2.id,
      vetId: vet2Profile.id,
    },
  });
  console.log(`  ✓ Veterinarians assigned to kennels`);

  // Get breeds for dogs
  const labrador = await prisma.breed.findUnique({ where: { name: 'Labrador Retriever' } });
  const golden = await prisma.breed.findUnique({ where: { name: 'Golden Retriever' } });
  const germanShepherd = await prisma.breed.findUnique({ where: { name: 'German Shepherd' } });
  const beagle = await prisma.breed.findUnique({ where: { name: 'Beagle' } });
  const poodle = await prisma.breed.findUnique({ where: { name: 'Poodle' } });
  const shiba = await prisma.breed.findUnique({ where: { name: 'Shiba Inu' } });

  // Create many dogs with complete data
  console.log('\nCreating dogs...');
  const dogs = [];

  if (labrador) {
    const dog1 = await prisma.dog.upsert({
      where: { microchip: '985112345678901' },
      update: {},
      create: {
        name: 'Max',
        breedId: labrador.id,
        gender: 'MALE',
        birthDate: new Date('2022-03-15'),
        color: 'Amarillo',
        microchip: '985112345678901',
        pedigree: 'LOE-LAB-12345',
        status: 'AVAILABLE',
        visibility: 'PUBLIC',
        kennelId: kennel.id,
        internalNotes: 'Excelente temperamento, muy juguetón. Campeón juvenil 2023.',
      },
    });
    dogs.push(dog1);

    const dog2 = await prisma.dog.upsert({
      where: { microchip: '985112345678902' },
      update: {},
      create: {
        name: 'Luna',
        breedId: labrador.id,
        gender: 'FEMALE',
        birthDate: new Date('2021-06-20'),
        color: 'Negro',
        microchip: '985112345678902',
        pedigree: 'LOE-LAB-12346',
        status: 'REPRODUCTIVE',
        visibility: 'PUBLIC',
        kennelId: kennel.id,
        internalNotes: 'Primera camada prevista para primavera 2024. Excelente línea de sangre.',
      },
    });
    dogs.push(dog2);

    const dog3 = await prisma.dog.upsert({
      where: { microchip: '985112345678903' },
      update: {},
      create: {
        name: 'Rocky',
        breedId: labrador.id,
        gender: 'MALE',
        birthDate: new Date('2023-01-10'),
        color: 'Chocolate',
        microchip: '985112345678903',
        pedigree: 'LOE-LAB-12347',
        status: 'AVAILABLE',
        visibility: 'PUBLIC',
        kennelId: kennel.id,
        internalNotes: 'Cachorro disponible. Muy inteligente y fácil de entrenar.',
      },
    });
    dogs.push(dog3);
  }

  if (golden) {
    const dog4 = await prisma.dog.upsert({
      where: { microchip: '985112345678904' },
      update: {},
      create: {
        name: 'Bella',
        breedId: golden.id,
        gender: 'FEMALE',
        birthDate: new Date('2021-09-05'),
        color: 'Dorado Claro',
        microchip: '985112345678904',
        pedigree: 'LOE-GLD-78901',
        status: 'REPRODUCTIVE',
        visibility: 'PUBLIC',
        kennelId: kennel.id,
        internalNotes: 'Madre de la camada de San Valentín. Excelente cuidadora.',
      },
    });
    dogs.push(dog4);

    const dog5 = await prisma.dog.upsert({
      where: { microchip: '985112345678905' },
      update: {},
      create: {
        name: 'Charlie',
        breedId: golden.id,
        gender: 'MALE',
        birthDate: new Date('2022-11-20'),
        color: 'Dorado',
        microchip: '985112345678905',
        pedigree: 'LOE-GLD-78902',
        status: 'RESERVED',
        visibility: 'PUBLIC',
        kennelId: kennel.id,
        internalNotes: 'Padre de la camada de San Valentín. Campeón de belleza 2023.',
      },
    });
    dogs.push(dog5);

    const dog6 = await prisma.dog.upsert({
      where: { microchip: '985112345678906' },
      update: {},
      create: {
        name: 'Daisy',
        breedId: golden.id,
        gender: 'FEMALE',
        birthDate: new Date('2023-05-12'),
        color: 'Dorado Oscuro',
        microchip: '985112345678906',
        pedigree: 'LOE-GLD-78903',
        status: 'AVAILABLE',
        visibility: 'PUBLIC',
        kennelId: kennel.id,
        internalNotes: 'Cachorra de 10 meses. Muy cariñosa y sociable.',
      },
    });
    dogs.push(dog6);
  }

  if (germanShepherd) {
    const dog7 = await prisma.dog.upsert({
      where: { microchip: '985112345678907' },
      update: {},
      create: {
        name: 'Thor',
        breedId: germanShepherd.id,
        gender: 'MALE',
        birthDate: new Date('2021-04-08'),
        color: 'Negro y Fuego',
        microchip: '985112345678907',
        pedigree: 'LOE-GSD-45601',
        status: 'REPRODUCTIVE',
        visibility: 'PUBLIC',
        kennelId: kennel2.id,
        internalNotes: 'Perro de protección entrenado. Excelente carácter de trabajo.',
      },
    });
    dogs.push(dog7);

    const dog8 = await prisma.dog.upsert({
      where: { microchip: '985112345678908' },
      update: {},
      create: {
        name: 'Sasha',
        breedId: germanShepherd.id,
        gender: 'FEMALE',
        birthDate: new Date('2022-02-14'),
        color: 'Negro y Fuego',
        microchip: '985112345678908',
        pedigree: 'LOE-GSD-45602',
        status: 'AVAILABLE',
        visibility: 'PUBLIC',
        kennelId: kennel2.id,
        internalNotes: 'Joven hembra con gran potencial para deporte o compañía.',
      },
    });
    dogs.push(dog8);
  }

  if (beagle) {
    const dog9 = await prisma.dog.upsert({
      where: { microchip: '985112345678909' },
      update: {},
      create: {
        name: 'Oliver',
        breedId: beagle.id,
        gender: 'MALE',
        birthDate: new Date('2023-08-01'),
        color: 'Tricolor',
        microchip: '985112345678909',
        pedigree: 'LOE-BGL-32101',
        status: 'AVAILABLE',
        visibility: 'PUBLIC',
        kennelId: kennel.id,
        internalNotes: 'Cachorro muy activo y juguetón. Ideal para familia.',
      },
    });
    dogs.push(dog9);
  }

  if (poodle) {
    const dog10 = await prisma.dog.upsert({
      where: { microchip: '985112345678910' },
      update: {},
      create: {
        name: 'Coco',
        breedId: poodle.id,
        gender: 'FEMALE',
        birthDate: new Date('2022-12-25'),
        color: 'Blanco',
        microchip: '985112345678910',
        pedigree: 'LOE-PDL-65401',
        status: 'AVAILABLE',
        visibility: 'PUBLIC',
        kennelId: kennel.id,
        internalNotes: 'Poodle toy. Hipoalergénica. Muy inteligente.',
      },
    });
    dogs.push(dog10);
  }

  if (shiba) {
    const dog11 = await prisma.dog.upsert({
      where: { microchip: '985112345678911' },
      update: {},
      create: {
        name: 'Yuki',
        breedId: shiba.id,
        gender: 'FEMALE',
        birthDate: new Date('2023-03-03'),
        color: 'Rojo Sésamo',
        microchip: '985112345678911',
        pedigree: 'LOE-SHI-98701',
        status: 'SOLD',
        visibility: 'PRIVATE',
        kennelId: kennel2.id,
        internalNotes: 'Vendida. Entrega programada para próxima semana.',
      },
    });
    dogs.push(dog11);
  }
  console.log(`  ✓ ${dogs.length} dogs created`);

  // Create dog photos
  console.log('\nCreating dog photos...');
  for (const dog of dogs) {
    await prisma.dogPhoto.createMany({
      data: [
        { dogId: dog.id, url: `https://placedog.net/500/500?id=${dog.name}`, isMain: true, order: 0 },
        { dogId: dog.id, url: `https://placedog.net/500/500?id=${dog.name}2`, isMain: false, order: 1 },
      ],
    });
  }
  console.log(`  ✓ Dog photos created`);

  // Create litters
  console.log('\nCreating litters...');
  const bella = dogs.find(d => d.name === 'Bella');
  const charlie = dogs.find(d => d.name === 'Charlie');
  const luna = dogs.find(d => d.name === 'Luna');
  const max = dogs.find(d => d.name === 'Max');

  let litter1;
  if (bella && charlie) {
    litter1 = await prisma.litter.upsert({
      where: { id: 'litter-san-valentin' },
      update: {},
      create: {
        id: 'litter-san-valentin',
        birthDate: new Date('2024-02-14'),
        puppyCount: 6,
        deadPuppies: 0,
        notes: 'Camada de San Valentín. 3 machos y 3 hembras. Todos los cachorros nacieron sanos y fuertes.',
        kennelId: kennel.id,
        fatherId: charlie.id,
        motherId: bella.id,
      },
    });
    console.log(`  ✓ Litter 1: Camada de San Valentín`);
  }

  let litter2;
  if (luna && max) {
    litter2 = await prisma.litter.upsert({
      where: { id: 'luna-primera' },
      update: {},
      create: {
        id: 'luna-primera',
        birthDate: new Date('2024-03-20'),
        puppyCount: 8,
        deadPuppies: 1,
        notes: 'Primera camada de Luna. 5 machos y 3 hembras. Un macho nació débil y no sobrevivió.',
        kennelId: kennel.id,
        fatherId: max.id,
        motherId: luna.id,
      },
    });
    console.log(`  ✓ Litter 2: Primera camada de Luna`);
  }

  // Create litter puppies
  console.log('\nCreating litter puppies...');
  if (litter1) {
    await prisma.litterPuppy.createMany({
      data: [
        { litterId: litter1.id, name: 'Cupid', gender: 'MALE', color: 'Dorado', status: 'RESERVED' },
        { litterId: litter1.id, name: 'Amor', gender: 'FEMALE', color: 'Dorado Claro', status: 'AVAILABLE' },
        { litterId: litter1.id, name: 'Romeo', gender: 'MALE', color: 'Dorado', status: 'AVAILABLE' },
        { litterId: litter1.id, name: 'Julieta', gender: 'FEMALE', color: 'Dorado', status: 'SOLD' },
        { litterId: litter1.id, name: 'Valentín', gender: 'MALE', color: 'Dorado Oscuro', status: 'AVAILABLE' },
        { litterId: litter1.id, name: 'Corazón', gender: 'FEMALE', color: 'Dorado Claro', status: 'RESERVED' },
      ],
    });
  }

  if (litter2) {
    await prisma.litterPuppy.createMany({
      data: [
        { litterId: litter2.id, name: 'Negro', gender: 'MALE', color: 'Negro', status: 'AVAILABLE' },
        { litterId: litter2.id, name: 'Chocolate', gender: 'FEMALE', color: 'Chocolate', status: 'AVAILABLE' },
        { litterId: litter2.id, name: 'Miel', gender: 'FEMALE', color: 'Amarillo', status: 'RESERVED' },
        { litterId: litter2.id, name: 'Canela', gender: 'FEMALE', color: 'Amarillo', status: 'AVAILABLE' },
        { litterId: litter2.id, name: 'Café', gender: 'MALE', color: 'Chocolate', status: 'SOLD' },
        { litterId: litter2.id, name: 'Oro', gender: 'MALE', color: 'Amarillo', status: 'AVAILABLE' },
        { litterId: litter2.id, name: 'Noche', gender: 'MALE', color: 'Negro', status: 'AVAILABLE' },
      ],
    });
  }
  console.log(`  ✓ Litter puppies created`);

  // Create customers
  console.log('\nCreating customers...');
  const customer1 = await prisma.customer.upsert({
    where: { id: 'customer-juan' },
    update: {},
    create: {
      id: 'customer-juan',
      kennelId: kennel.id,
      userId: customerUser.id,
      firstName: 'Juan',
      lastName: 'Pérez González',
      email: 'customer@petwellly.com',
      phone: '+34 667 890 123',
      address: 'Calle Alcalá 456, 2ºB',
      city: 'Madrid',
      notes: 'Cliente interesado en Golden Retriever. Primera vez con perro de raza.',
      isArchived: false,
    },
  });

  const customer2 = await prisma.customer.upsert({
    where: { id: 'customer-laura' },
    update: {},
    create: {
      id: 'customer-laura',
      kennelId: kennel.id,
      userId: customer2User.id,
      firstName: 'Laura',
      lastName: 'Gómez Ruiz',
      email: 'laura@gmail.com',
      phone: '+34 678 901 234',
      address: 'Avenida Diagonal 789',
      city: 'Barcelona',
      notes: 'Segunda compra en el criadero. Muy satisfecha con su primer perro.',
      isArchived: false,
    },
  });

  const customer3 = await prisma.customer.upsert({
    where: { id: 'customer-roberto' },
    update: {},
    create: {
      id: 'customer-roberto',
      kennelId: kennel.id,
      firstName: 'Roberto',
      lastName: 'Martínez López',
      email: 'roberto.ml@outlook.com',
      phone: '+34 689 012 345',
      address: 'Calle Serrano 123',
      city: 'Madrid',
      notes: 'Busca perro para compañía de su hijo de 8 años.',
      isArchived: false,
    },
  });

  const customer4 = await prisma.customer.upsert({
    where: { id: 'customer-ana' },
    update: {},
    create: {
      id: 'customer-ana',
      kennelId: kennel2.id,
      firstName: 'Ana',
      lastName: 'Sánchez Vega',
      email: 'ana.vega@empresa.com',
      phone: '+34 690 123 456',
      address: 'Paseo de Gracia 567',
      city: 'Barcelona',
      notes: 'Busca Pastor Alemán para protección de finca.',
      isArchived: false,
    },
  });
  console.log(`  ✓ 4 customers created`);

  // Create medical records
  console.log('\nCreating medical records...');
  if (dogs.length > 0) {
    await prisma.medicalRecord.createMany({
      data: [
        {
          dogId: dogs[0].id,
          vetId: vetProfile.id,
          createdBy: breeder.id,
          type: 'VACCINE',
          date: new Date('2024-01-15'),
          description: 'Vacuna polivalente anual',
          nextDate: new Date('2025-01-15'),
          vaccineName: 'Versican Plus DHPPi+L',
          vaccineLot: 'ABC12345',
          vaccineLab: 'Zoetis',
        },
        {
          dogId: dogs[1].id,
          vetId: vetProfile.id,
          createdBy: breeder.id,
          type: 'EXAM',
          date: new Date('2024-02-01'),
          description: 'Ecografía prenatal - 6 cachorros confirmados',
          nextDate: new Date('2024-02-14'),
        },
        {
          dogId: dogs[2].id,
          vetId: vetProfile.id,
          createdBy: breeder.id,
          type: 'DEWORMING',
          date: new Date('2024-03-10'),
          description: 'Desparasitación interna mensual',
          nextDate: new Date('2024-04-10'),
          dewormerProduct: 'Milbemax',
          weightAtDate: 12.5,
        },
        {
          dogId: dogs[0].id,
          vetId: vetProfile.id,
          createdBy: breeder.id,
          type: 'CONSULTATION',
          date: new Date('2024-01-20'),
          description: 'Revisión rutinaria',
          diagnosis: 'Excelente estado de salud',
          treatment: 'Continuar con dieta actual',
        },
        {
          dogId: dogs[3].id,
          vetId: vetProfile.id,
          createdBy: breeder.id,
          type: 'VACCINE',
          date: new Date('2024-02-20'),
          description: 'Vacuna de la rabia',
          nextDate: new Date('2025-02-20'),
          vaccineName: 'Rabigen Mono',
          vaccineLot: 'XYZ789',
          vaccineLab: 'Boehringer',
        },
        {
          dogId: dogs[4].id,
          vetId: vetProfile.id,
          createdBy: breeder.id,
          type: 'SURGERY',
          date: new Date('2023-12-10'),
          description: 'Castración preventiva',
          diagnosis: 'Recuperación exitosa',
          treatment: 'Reposo 7 días, antibióticos',
          postOpNotes: 'Sin complicaciones',
        },
      ],
    });
  }
  console.log(`  ✓ Medical records created`);

  // Create reservations
  console.log('\nCreating reservations...');
  const daisy = dogs.find(d => d.name === 'Daisy');
  const oliver = dogs.find(d => d.name === 'Oliver');

  if (daisy && customer1) {
    await prisma.reservation.create({
      data: {
        kennelId: kennel.id,
        dogId: daisy.id,
        customerId: customer1.id,
        userId: customerUser.id,
        status: 'PENDING',
        amount: 1500,
        deposit: 300,
        notes: 'Reserva para cachorra Daisy',
        requestMessage: 'Estoy muy interesado en esta cachorra. Tengo experiencia con Golden Retrievers.',
      },
    });
    console.log(`  ✓ Reservation for Daisy`);
  }

  if (oliver && customer2) {
    await prisma.reservation.create({
      data: {
        kennelId: kennel.id,
        dogId: oliver.id,
        customerId: customer2.id,
        status: 'CONFIRMED',
        amount: 800,
        deposit: 200,
        notes: 'Reserva confirmada con entrega en mayo',
      },
    });
    console.log(`  ✓ Reservation for Oliver`);
  }

  const yuki = dogs.find(d => d.name === 'Yuki');
  if (yuki && customer4) {
    await prisma.reservation.create({
      data: {
        kennelId: kennel2.id,
        dogId: yuki.id,
        customerId: customer4.id,
        status: 'COMPLETED',
        amount: 2500,
        deposit: 500,
        completedAt: new Date('2024-01-15'),
        notes: 'Venta completada. Cliente muy satisfecho.',
      },
    });
    console.log(`  ✓ Completed sale for Yuki`);
  }

  // Create finance data
  console.log('\nCreating finance data...');

  // Default transaction categories are created automatically by the controller
  // Get the first kennel
  const mainKennel = kennel;

  if (mainKennel) {
    // Get categories after initialization
    const incomeCategory = await prisma.transactionCategory.findFirst({
      where: { kennelId: mainKennel.id, type: 'INCOME', name: 'Venta de perros' }
    });
    const expenseCategoryFood = await prisma.transactionCategory.findFirst({
      where: { kennelId: mainKennel.id, type: 'EXPENSE', name: 'Alimentación' }
    });
    const expenseCategoryVet = await prisma.transactionCategory.findFirst({
      where: { kennelId: mainKennel.id, type: 'EXPENSE', name: 'Veterinario' }
    });
    const expenseCategoryEquip = await prisma.transactionCategory.findFirst({
      where: { kennelId: mainKennel.id, type: 'EXPENSE', name: 'Equipamiento' }
    });

    // Create transactions
    if (incomeCategory && expenseCategoryFood && expenseCategoryVet) {
      const transactions = [
        {
          type: 'INCOME' as const,
          amount: 2500,
          date: new Date('2024-01-15'),
          description: 'Venta de cachorro Yuki',
          categoryId: incomeCategory.id,
          paymentMethod: 'TRANSFER',
          reference: 'TRX-001',
          status: 'COMPLETED',
          createdBy: breeder.id,
        },
        {
          type: 'INCOME' as const,
          amount: 1800,
          date: new Date('2024-02-20'),
          description: 'Señal reserva cachorro Labrador',
          categoryId: incomeCategory.id,
          paymentMethod: 'CASH',
          status: 'COMPLETED',
          createdBy: breeder.id,
        },
        {
          type: 'INCOME' as const,
          amount: 3200,
          date: new Date('2024-03-10'),
          description: 'Venta cachorro Pastor Alemán',
          categoryId: incomeCategory.id,
          paymentMethod: 'CARD',
          reference: 'POS-4521',
          status: 'COMPLETED',
          createdBy: breeder.id,
        },
        {
          type: 'EXPENSE' as const,
          amount: 450,
          date: new Date('2024-01-05'),
          description: 'Compra pienso premium 20kg',
          categoryId: expenseCategoryFood.id,
          paymentMethod: 'TRANSFER',
          reference: 'FAC-2024-001',
          status: 'COMPLETED',
          createdBy: breeder.id,
        },
        {
          type: 'EXPENSE' as const,
          amount: 280,
          date: new Date('2024-02-15'),
          description: 'Vacunas cachorros camada Bella',
          categoryId: expenseCategoryVet.id,
          paymentMethod: 'CASH',
          status: 'COMPLETED',
          createdBy: vetUser.id,
        },
        {
          type: 'EXPENSE' as const,
          amount: 120,
          date: new Date('2024-03-01'),
          description: 'Desparasitantes',
          categoryId: expenseCategoryVet.id,
          paymentMethod: 'CARD',
          status: 'COMPLETED',
          createdBy: vetUser.id,
        },
        {
          type: 'EXPENSE' as const,
          amount: 350,
          date: new Date('2024-03-20'),
          description: 'Jaulas transporte nuevas',
          categoryId: expenseCategoryEquip?.id || expenseCategoryFood.id,
          paymentMethod: 'TRANSFER',
          reference: 'AMZ-8992',
          status: 'COMPLETED',
          createdBy: breeder.id,
        },
        {
          type: 'INCOME' as const,
          amount: 800,
          date: new Date('2024-04-05'),
          description: 'Servicio de monta',
          categoryId: incomeCategory.id,
          paymentMethod: 'CASH',
          status: 'COMPLETED',
          createdBy: breeder.id,
        },
        {
          type: 'EXPENSE' as const,
          amount: 150,
          date: new Date('2024-04-10'),
          description: 'Pienso mensual',
          categoryId: expenseCategoryFood.id,
          paymentMethod: 'CARD',
          status: 'COMPLETED',
          createdBy: breeder.id,
        },
        {
          type: 'INCOME' as const,
          amount: 2100,
          date: new Date(),
          description: 'Venta cachorro reciente',
          categoryId: incomeCategory.id,
          paymentMethod: 'TRANSFER',
          status: 'COMPLETED',
          createdBy: breeder.id,
        },
      ];

      for (const tx of transactions) {
        await prisma.transaction.create({
          data: {
            ...tx,
            kennelId: mainKennel.id,
          },
        });
      }
      console.log(`  ✓ ${transactions.length} transactions created`);
    }

    // Create invoices
    if (customer1 && customer2) {
      const invoices = [
        {
          number: 'INV-2024-0001',
          issueDate: new Date('2024-01-15'),
          dueDate: new Date('2024-02-15'),
          subtotal: 2500,
          taxRate: 21,
          taxAmount: 525,
          total: 3025,
          status: 'PAID',
          notes: 'Venta completa con pedigrí',
          customerId: customer4?.id || customer1.id,
        },
        {
          number: 'INV-2024-0002',
          issueDate: new Date('2024-03-10'),
          dueDate: new Date('2024-04-10'),
          subtotal: 1800,
          taxRate: 21,
          taxAmount: 378,
          total: 2178,
          status: 'PAID',
          notes: 'Reserva con entrega en verano',
          customerId: customer1.id,
        },
        {
          number: 'INV-2024-0003',
          issueDate: new Date('2024-04-01'),
          dueDate: new Date('2024-05-01'),
          subtotal: 3200,
          taxRate: 21,
          taxAmount: 672,
          total: 3872,
          status: 'PENDING',
          notes: 'Pago pendiente - 50% señal',
          customerId: customer2.id,
        },
        {
          number: 'INV-2024-0004',
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          subtotal: 1500,
          taxRate: 21,
          taxAmount: 315,
          total: 1815,
          status: 'PENDING',
          notes: 'Factura reciente',
          customerId: customer3?.id || customer1.id,
        },
      ];

      for (const inv of invoices) {
        await prisma.invoice.create({
          data: {
            ...inv,
            kennelId: mainKennel.id,
            items: {
              create: [
                {
                  description: 'Venta de perro',
                  quantity: 1,
                  unitPrice: inv.subtotal,
                  total: inv.subtotal,
                }
              ]
            }
          },
        });
      }
      console.log(`  ✓ ${invoices.length} invoices created`);
    }

    // Create inventory items
    const inventoryItems = [
      {
        name: 'Pienso Premium Adulto',
        category: 'FOOD' as const,
        description: 'Pienso de alta calidad para perros adultos',
        quantity: 150,
        unit: 'kg',
        minStock: 50,
        cost: 3.5,
        supplier: 'Royal Canin',
      },
      {
        name: 'Pienso Cachorros',
        category: 'FOOD' as const,
        description: 'Fórmula especial para cachorros',
        quantity: 80,
        unit: 'kg',
        minStock: 30,
        cost: 4.2,
        supplier: 'Royal Canin',
      },
      {
        name: 'Vacuna Polivalente',
        category: 'MEDICINE' as const,
        description: 'Vacuna polivalente para perros',
        quantity: 25,
        unit: 'dosis',
        minStock: 10,
        cost: 18.5,
        supplier: 'Zoetis',
      },
      {
        name: 'Desparasitante Interno',
        category: 'MEDICINE' as const,
        description: 'Tabletas desparasitantes',
        quantity: 5,
        unit: 'caja',
        minStock: 10,
        cost: 12.0,
        supplier: 'Bayer',
      },
      {
        name: 'Correas de nylon',
        category: 'SUPPLY' as const,
        description: 'Correas resistentes varios colores',
        quantity: 45,
        unit: 'unidad',
        minStock: 15,
        cost: 8.5,
        supplier: 'Pet Supplies Co',
      },
      {
        name: 'Transportín mediano',
        category: 'EQUIPMENT' as const,
        description: 'Transportín para perros medianos',
        quantity: 8,
        unit: 'unidad',
        minStock: 3,
        cost: 45.0,
        supplier: 'Amazon',
      },
      {
        name: 'Shampoo antipulgas',
        category: 'SUPPLY' as const,
        description: 'Shampoo medicado',
        quantity: 12,
        unit: 'botella',
        minStock: 5,
        cost: 9.9,
        supplier: 'VetCare',
      },
      {
        name: 'Toallas desechables',
        category: 'SUPPLY' as const,
        description: 'Toallas para limpieza',
        quantity: 200,
        unit: 'unidad',
        minStock: 50,
        cost: 0.5,
        supplier: 'Cleaning Pro',
      },
    ];

    for (const item of inventoryItems) {
      await prisma.inventoryItem.create({
        data: {
          ...item,
          kennelId: mainKennel.id,
          movements: {
            create: {
              type: 'IN',
              quantity: item.quantity,
              reason: 'INITIAL',
              notes: 'Stock inicial',
            }
          }
        },
      });
    }
    console.log(`  ✓ ${inventoryItems.length} inventory items created`);
  }

  // Create audit logs
  console.log('\nCreating audit logs...');
  await prisma.auditLog.createMany({
    data: [
      {
        userId: manager.id,
        action: 'LOGIN',
        entity: 'User',
        entityId: manager.id,
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 Chrome/120.0',
      },
      {
        userId: breeder.id,
        action: 'CREATE',
        entity: 'Dog',
        entityId: dogs[0]?.id || 'unknown',
        newData: JSON.stringify({ name: dogs[0]?.name, breed: 'Labrador' }),
        ipAddress: '192.168.1.101',
      },
      {
        userId: breeder.id,
        action: 'CREATE',
        entity: 'Litter',
        entityId: litter1?.id || 'unknown',
        newData: JSON.stringify({ puppyCount: 6, mother: 'Bella' }),
        ipAddress: '192.168.1.101',
      },
      {
        userId: vetUser.id,
        action: 'CREATE',
        entity: 'MedicalRecord',
        newData: JSON.stringify({ type: 'VACCINE', dog: dogs[0]?.name }),
        ipAddress: '192.168.1.102',
      },
    ],
  });
  console.log(`  ✓ Audit logs created`);

  console.log('\n✅ Database seeded successfully!\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                    DEMO CREDENTIALS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Manager:    manager@petwellly.com   / Manager123!');
  console.log('Breeder:    breeder@petwellly.com  / Breeder123!');
  console.log('Vet:        vet@petwellly.com      / Vet123!');
  console.log('Customer:   customer@petwellly.com / Customer123!');
  console.log('');
  console.log('Additional users:');
  console.log('Breeder 2:  ana@caninepro.es           / Breeder123!');
  console.log('Vet 2:      laura@vetcare.es           / Vet123!');
  console.log('Customer 2: laura@gmail.com            / Customer123!');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('Summary:');
  console.log(`  • ${FCI_BREEDS.length} breeds`);
  console.log(`  • 6 users (2 managers, 2 breeders, 2 vets, 2 customers)`);
  console.log(`  • 2 kennels`);
  console.log(`  • ${dogs.length} dogs with photos`);
  console.log(`  • 2 litters with 13 puppies`);
  console.log(`  • 4 customers`);
  console.log(`  • 6 medical records`);
  console.log(`  • 3 reservations`);
  console.log(`  • 10 transactions (income/expense)`);
  // Create documents for customers
  console.log('\nCreating documents for customers...');

  if (customer1 && dogs.length > 0) {
    const max = dogs.find(d => d.name === 'Max');
    if (max) {
      await prisma.document.createMany({
        data: [
          {
            type: 'CONTRACT',
            name: 'Contrato de Compra - Max',
            description: 'Contrato de compraventa del perro Max',
            url: '/uploads/contracts/contract-max.pdf',
            fileName: 'contract-max.pdf',
            fileSize: 125000,
            mimeType: 'application/pdf',
            status: 'ACTIVE',
            issuedDate: new Date('2024-01-10'),
            kennelId: kennel.id,
            dogId: max.id,
            customerId: customer1.id,
            uploadedBy: breeder.id,
            contractData: JSON.stringify({ price: 1500, deposit: 300, paymentTerms: 'Pago completo al entrega' }),
          },
          {
            type: 'PEDIGREE',
            name: 'Pedigree Max - LOE',
            description: 'Certificado de pedigree oficial del Labrador Retriever Max',
            url: '/uploads/pedigrees/pedigree-max.pdf',
            fileName: 'pedigree-max.pdf',
            fileSize: 85000,
            mimeType: 'application/pdf',
            status: 'ACTIVE',
            issuedDate: new Date('2024-01-08'),
            kennelId: kennel.id,
            dogId: max.id,
            customerId: customer1.id,
            uploadedBy: breeder.id,
          },
          {
            type: 'HEALTH_CERT',
            name: 'Certificado de Salud - Max',
            description: 'Revision veterinaria y certificado de salud',
            url: '/uploads/health/health-cert-max.pdf',
            fileName: 'health-cert-max.pdf',
            fileSize: 65000,
            mimeType: 'application/pdf',
            status: 'ACTIVE',
            issuedDate: new Date('2024-01-09'),
            expiryDate: new Date('2025-01-09'),
            kennelId: kennel.id,
            dogId: max.id,
            customerId: customer1.id,
            uploadedBy: vetUser.id,
          },
          {
            type: 'VACCINE_CERT',
            name: 'Cartilla de Vacunacion - Max',
            description: 'Registro de vacunas aplicadas',
            url: '/uploads/vaccines/vaccine-max.pdf',
            fileName: 'vaccine-max.pdf',
            fileSize: 45000,
            mimeType: 'application/pdf',
            status: 'ACTIVE',
            issuedDate: new Date('2024-01-09'),
            kennelId: kennel.id,
            dogId: max.id,
            customerId: customer1.id,
            uploadedBy: vetUser.id,
          },
        ],
      });
      console.log(`  ✓ Documents created for customer1 (Max)`);
    }
  }

  if (customer2 && dogs.length > 0) {
    const luna = dogs.find(d => d.name === 'Luna');
    if (luna) {
      await prisma.document.createMany({
        data: [
          {
            type: 'CONTRACT',
            name: 'Contrato de Reserva - Luna',
            description: 'Contrato de reserva para la cachorra Luna',
            url: '/uploads/contracts/contract-luna.pdf',
            fileName: 'contract-luna.pdf',
            fileSize: 118000,
            mimeType: 'application/pdf',
            status: 'ACTIVE',
            issuedDate: new Date('2024-02-15'),
            kennelId: kennel.id,
            dogId: luna.id,
            customerId: customer2.id,
            uploadedBy: breeder.id,
            contractData: JSON.stringify({ price: 1800, deposit: 400, paymentTerms: '50% senal, 50% a la entrega' }),
          },
          {
            type: 'INVOICE',
            name: 'Factura - Senal Luna',
            description: 'Factura del pago de senal',
            url: '/uploads/invoices/invoice-luna-deposit.pdf',
            fileName: 'invoice-luna-deposit.pdf',
            fileSize: 55000,
            mimeType: 'application/pdf',
            status: 'ACTIVE',
            issuedDate: new Date('2024-02-15'),
            kennelId: kennel.id,
            dogId: luna.id,
            customerId: customer2.id,
            uploadedBy: breeder.id,
          },
        ],
      });
      console.log(`  ✓ Documents created for customer2 (Luna)`);
    }
  }

  if (customer4) {
    await prisma.document.createMany({
      data: [
        {
          type: 'CONTRACT',
          name: 'Contrato de Compra - Yuki',
          description: 'Contrato de compraventa completado',
          url: '/uploads/contracts/contract-yuki.pdf',
          fileName: 'contract-yuki.pdf',
          fileSize: 132000,
          mimeType: 'application/pdf',
          status: 'ACTIVE',
          issuedDate: new Date('2024-01-14'),
          kennelId: kennel2.id,
          customerId: customer4.id,
          uploadedBy: breeder2?.id || breeder.id,
          contractData: JSON.stringify({ price: 2500, deposit: 500, paymentTerms: 'Pago completo' }),
        },
        {
          type: 'PEDIGREE',
          name: 'Pedigree Yuki - AKC',
          description: 'Certificado de pedigree AKC del Pastor Aleman Yuki',
          url: '/uploads/pedigrees/pedigree-yuki.pdf',
          fileName: 'pedigree-yuki.pdf',
          fileSize: 92000,
          mimeType: 'application/pdf',
          status: 'ACTIVE',
          issuedDate: new Date('2024-01-12'),
          kennelId: kennel2.id,
          customerId: customer4.id,
          uploadedBy: breeder2?.id || breeder.id,
        },
      ],
    });
    console.log(`  ✓ Documents created for customer4 (Yuki)`);
  }

  // Create messages between customers and breeder
  console.log('\nCreating messages...');

  if (customer1?.userId && breeder.id) {
    await prisma.message.createMany({
      data: [
        {
          content: 'Hola, estoy interesado en el cachorro Max. Podriamos concertar una visita?',
          senderId: customer1.userId,
          receiverId: breeder.id,
          read: true,
          createdAt: new Date('2024-01-05T10:30:00'),
        },
        {
          content: 'Hola Juan! Claro que si. Te viene bien este sabado por la manana?',
          senderId: breeder.id,
          receiverId: customer1.userId,
          read: true,
          createdAt: new Date('2024-01-05T11:15:00'),
        },
        {
          content: 'Perfecto, a que hora?',
          senderId: customer1.userId,
          receiverId: breeder.id,
          read: true,
          createdAt: new Date('2024-01-05T11:20:00'),
        },
        {
          content: 'A las 11:00 estaria bien. Te espero en el criadero.',
          senderId: breeder.id,
          receiverId: customer1.userId,
          read: true,
          createdAt: new Date('2024-01-05T11:25:00'),
        },
        {
          content: 'Muchas gracias por la visita de hoy. Max es adorable, me lo quedo. Cual es el siguiente paso?',
          senderId: customer1.userId,
          receiverId: breeder.id,
          read: true,
          createdAt: new Date('2024-01-06T16:45:00'),
        },
        {
          content: 'Me alegro mucho de que os haya gustado. Te preparo el contrato y te lo envio por email. El pago se puede hacer por transferencia.',
          senderId: breeder.id,
          receiverId: customer1.userId,
          read: true,
          createdAt: new Date('2024-01-06T17:00:00'),
        },
        {
          content: 'Hola Carlos, ya he recibido los documentos. Cuando podria pasar a recoger a Max?',
          senderId: customer1.userId,
          receiverId: breeder.id,
          read: false,
          createdAt: new Date('2024-04-12T09:00:00'),
        },
      ],
    });
    console.log(`  ✓ Messages between customer1 and breeder`);
  }

  if (customer2?.userId && breeder.id) {
    await prisma.message.createMany({
      data: [
        {
          content: 'Buenas tardes, me gustaria reservar a la cachorra Luna. Esta disponible?',
          senderId: customer2.userId,
          receiverId: breeder.id,
          read: true,
          createdAt: new Date('2024-02-10T14:20:00'),
        },
        {
          content: 'Hola Laura, si Luna todavia esta disponible. Has visto sus fotos en la web?',
          senderId: breeder.id,
          receiverId: customer2.userId,
          read: true,
          createdAt: new Date('2024-02-10T15:30:00'),
        },
        {
          content: 'Si, es preciosa. Vengo de parte de la recomendacion de Maria. Me dijo que ustedes son muy profesionales.',
          senderId: customer2.userId,
          receiverId: breeder.id,
          read: true,
          createdAt: new Date('2024-02-10T15:45:00'),
        },
        {
          content: 'Que bien! Maria es una clienta muy querida. Te preparo la reserva con mucho gusto.',
          senderId: breeder.id,
          receiverId: customer2.userId,
          read: true,
          createdAt: new Date('2024-02-10T16:00:00'),
        },
        {
          content: 'Hola, queria saber si Luna ya tiene todas las vacunas.',
          senderId: customer2.userId,
          receiverId: breeder.id,
          read: false,
          createdAt: new Date('2024-04-12T10:30:00'),
        },
      ],
    });
    console.log(`  ✓ Messages between customer2 and breeder`);
  }

  if (customer4?.userId && (breeder2?.id || breeder.id)) {
    const breederId = breeder2?.id || breeder.id;
    await prisma.message.createMany({
      data: [
        {
          content: 'Hola Ana, confirmo que recibi el pago de Yuki. Todo correcto con la documentacion?',
          senderId: breederId,
          receiverId: customer4.userId,
          read: true,
          createdAt: new Date('2024-01-20T11:00:00'),
        },
        {
          content: 'Todo perfecto, muchas gracias. Yuki se esta adaptando muy bien a casa.',
          senderId: customer4.userId,
          receiverId: breederId,
          read: true,
          createdAt: new Date('2024-01-20T18:30:00'),
        },
        {
          content: 'Me alegro mucho de escuchar eso. Cualquier duda que tengas sobre su cuidado, aqui estoy.',
          senderId: breederId,
          receiverId: customer4.userId,
          read: true,
          createdAt: new Date('2024-01-20T19:00:00'),
        },
        {
          content: 'Gracias Carlos. Una pregunta, que pienso me recomiendas para Pastor Aleman de 3 meses?',
          senderId: customer4.userId,
          receiverId: breederId,
          read: false,
          createdAt: new Date('2024-04-12T11:15:00'),
        },
      ],
    });
    console.log(`  ✓ Messages between customer4 and breeder2`);
  }

  // ==================== GENETICS & REVIEWS SEED ====================
  console.log('\nCreating genetic tests...');
  const maxDog = dogs.find(d => d.name === 'Max');
  const bellaDog = dogs.find(d => d.name === 'Bella');
  const thorDog = dogs.find(d => d.name === 'Thor');

  if (maxDog) {
    await prisma.geneticTest.upsert({
      where: { id: 'gt-max-dm' },
      update: {},
      create: {
        id: 'gt-max-dm',
        dogId: maxDog.id,
        kennelId: kennel.id,
        testName: 'DM (Degenerative Myelopathy)',
        labName: 'Embark',
        result: 'CLEAR',
        testDate: new Date('2024-03-15'),
        notes: 'Resultado negativo en degeneración mielínica.',
      },
    });
  }

  if (bellaDog) {
    await prisma.geneticTest.upsert({
      where: { id: 'gt-bella-hd' },
      update: {},
      create: {
        id: 'gt-bella-hd',
        dogId: bellaDog.id,
        kennelId: kennel.id,
        testName: 'HD (Displasia de Cadera)',
        labName: 'OFA',
        result: 'CLEAR',
        testDate: new Date('2024-04-10'),
        certificateUrl: 'https://example.com/cert/hd-bella',
      },
    });
  }

  if (thorDog) {
    await prisma.geneticTest.upsert({
      where: { id: 'gt-thor-dm' },
      update: {},
      create: {
        id: 'gt-thor-dm',
        dogId: thorDog.id,
        kennelId: kennel2.id,
        testName: 'DM (Degenerative Myelopathy)',
        labName: 'Embark',
        result: 'CARRIER',
        testDate: new Date('2024-05-10'),
        notes: 'Portador sano, no desarrolla la enfermedad.',
      },
    });
  }
  console.log(`  ✓ Genetic tests created`);

  console.log('\nCreating breeding plans...');
  const charlieDog = dogs.find(d => d.name === 'Charlie');
  const lunaDog = dogs.find(d => d.name === 'Luna');

  if (charlieDog && bellaDog) {
    await prisma.breedingPlan.upsert({
      where: { id: 'bp-spring-2026' },
      update: {},
      create: {
        id: 'bp-spring-2026',
        name: 'Cruce Primavera 2026',
        kennelId: kennel.id,
        fatherId: charlieDog.id,
        motherId: bellaDog.id,
        plannedDate: new Date('2026-04-15'),
        predictedCoi: 3.5,
        goal: 'Mejorar pigmentación y temperamento',
        status: 'PLANNED',
        notes: 'Ambos padres CLEAR en DM.',
      },
    });
  }

  if (maxDog && lunaDog) {
    await prisma.breedingPlan.upsert({
      where: { id: 'bp-autumn-2025' },
      update: {},
      create: {
        id: 'bp-autumn-2025',
        name: 'Cruce Otoño 2025',
        kennelId: kennel.id,
        fatherId: maxDog.id,
        motherId: lunaDog.id,
        plannedDate: new Date('2025-10-01'),
        predictedCoi: 12.5,
        goal: 'Línea de trabajo',
        status: 'EXECUTED',
        notes: 'Camada de 6 cachorros.',
      },
    });
  }
  console.log(`  ✓ Breeding plans created`);

  console.log('\nCreating reviews...');
  if (customer1) {
    await prisma.review.upsert({
      where: { id: 'review-juan' },
      update: {},
      create: {
        id: 'review-juan',
        kennelId: kennel.id,
        customerId: customer1.id,
        rating: 5,
        comment: 'Excelente criadero, muy profesionales.',
        reply: 'Gracias Juan, un placer.',
        status: 'PUBLISHED',
        verifiedPurchase: true,
        source: 'INTERNAL',
      },
    });
  }

  if (customer2) {
    await prisma.review.upsert({
      where: { id: 'review-laura' },
      update: {},
      create: {
        id: 'review-laura',
        kennelId: kennel.id,
        customerId: customer2.id,
        rating: 4,
        comment: 'Buena experiencia, aunque el papeleo tardó un poco.',
        status: 'PUBLISHED',
        verifiedPurchase: true,
        source: 'GOOGLE',
      },
    });
  }

  if (customer3) {
    await prisma.review.upsert({
      where: { id: 'review-roberto' },
      update: {},
      create: {
        id: 'review-roberto',
        kennelId: kennel.id,
        customerId: customer3.id,
        rating: 2,
        comment: 'No respondieron a mis mensajes.',
        status: 'PENDING',
        verifiedPurchase: false,
        source: 'TRUSTPILOT',
      },
    });
  }
  console.log(`  ✓ Reviews created`);

  console.log('\nCreating verification requests...');
  await prisma.verificationRequest.upsert({
    where: { id: 'verif-golden-paws' },
    update: {},
    create: {
      id: 'verif-golden-paws',
      kennelId: kennel.id,
      status: 'IN_PROGRESS',
      submittedAt: new Date('2026-01-10'),
      steps: {
        create: [
          {
            id: 'vs-identity',
            name: 'Identidad del criador',
            description: 'Verificación de documento de identidad',
            status: 'COMPLETED',
            order: 1,
            completedAt: new Date('2026-01-10'),
          },
          {
            id: 'vs-license',
            name: 'Licencia municipal',
            description: 'Licencia de explotación zoológica',
            status: 'COMPLETED',
            order: 2,
            completedAt: new Date('2026-01-12'),
          },
          {
            id: 'vs-health',
            name: 'Inspección sanitaria',
            description: 'Visita veterinaria de control',
            status: 'IN_PROGRESS',
            order: 3,
          },
          {
            id: 'vs-facilities',
            name: 'Revisión de instalaciones',
            description: 'Fotos y videos de las instalaciones',
            status: 'PENDING',
            order: 4,
          },
        ],
      },
    },
  });
  console.log(`  ✓ Verification request created`);

  console.log(`  • 8 documents created (contracts, pedigrees, health certs)`);
  console.log(`  • 16 messages between customers and breeders`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
