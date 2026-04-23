import { Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

// Checklist templates by inspection type
const CHECKLIST_TEMPLATES: Record<string, { category: string; items: string[]; isCritical?: boolean[] }[]> = {
  HEALTH: [
    { category: 'Salud General', items: ['Estado de alerta y energia adecuados', 'Postura y marcha normales', 'Sin signos de dolor o malestar aparente', 'Condicion corporal apropiada'], isCritical: [false, false, true, true] },
    { category: 'Apariencia Fisica', items: ['Pelaje limpio, brillante, sin parasitos', 'Piel sin lesiones ni inflamaciones', 'Ojos limpios, sin secreciones', 'Oidos limpios, sin olor ni inflamacion', 'Dentadura completa, encias rosadas', 'Garras cortadas y en buen estado'], isCritical: [false, false, false, false, false, false] },
    { category: 'Sistemas Corporales', items: ['Respiracion normal', 'Aparato digestivo sin sintomas', 'Miccion y defecacion normales', 'Movilidad articular sin rigidez'], isCritical: [true, true, true, false] },
    { category: 'Documentacion Sanitaria', items: ['Cartilla de vacunacion al dia', 'Desparasitaciones internas al dia', 'Desparasitaciones externas al dia', 'Microchip implantado y funcionando', 'Pruebas geneticas realizadas'], isCritical: [true, true, true, true, false] },
  ],
  FINANCIAL: [
    { category: 'Registro de Ingresos', items: ['Todas las ventas registradas con factura', 'Reservas registradas con deposito', 'Ingresos por servicios registrados', 'Sin ingresos en efectivo sin justificar'], isCritical: [true, true, false, true] },
    { category: 'Registro de Gastos', items: ['Todos los gastos categorizados correctamente', 'Facturas de proveedores archivadas', 'Gastos veterinarios documentados', 'Gastos de alimentacion registrados'], isCritical: [false, false, false, false] },
    { category: 'Estado de Facturacion', items: ['Numeracion consecutiva sin huecos', 'Facturas vencidas identificadas', 'Impuestos calculados correctamente'], isCritical: [true, true, true] },
    { category: 'Inventario', items: ['Stock de alimentacion registrado', 'Stock de medicinas registrado', 'Valoracion de inventario actualizada'], isCritical: [false, false, false] },
    { category: 'Analisis', items: ['Margen bruto positivo', 'Ratio gastos/ingresos razonable', 'Sin transacciones sin categorizar'], isCritical: [true, false, false] },
  ],
  FACILITY: [
    { category: 'Higiene y Limpieza', items: ['Suelos limpios y secos', 'Ausencia de olores fuertes', 'Desinfeccion periodica documentada', 'Manejo adecuado de excrementos'], isCritical: [true, true, false, true] },
    { category: 'Instalaciones', items: ['Ventilacion adecuada', 'Temperatura controlada', 'Iluminacion suficiente', 'Espacio minimo por animal respetado', 'Zonas separadas adecuadamente'], isCritical: [true, true, false, true, true] },
    { category: 'Seguridad', items: ['Cerramientos seguros', 'Materiales no toxicos', 'Ausencia de objetos peligrosos', 'Extintores y kit primeros auxilios'], isCritical: [true, true, true, false] },
    { category: 'Comodidad', items: ['Camas limpias y adecuadas', 'Agua fresca disponible', 'Alimento almacenado correctamente', 'Enriquecimiento ambiental'], isCritical: [true, true, true, false] },
  ],
  DOCUMENTARY: [
    { category: 'Perros', items: ['Todos los perros tienen pedigree', 'Todos los perros tienen microchip', 'Cartillas de vacunacion completas', 'Certificados de salud vigentes'], isCritical: [true, true, true, false] },
    { category: 'Camadas', items: ['Registro de camadas completo', 'Documentacion de cachorros al dia', 'Contratos de venta archivados'], isCritical: [true, true, true] },
    { category: 'Criadero', items: ['Licencias y permisos vigentes', 'Registro en asociaciones al dia', 'Seguro de responsabilidad civil vigente'], isCritical: [true, true, true] },
    { category: 'Alertas', items: ['Sin documentos proximos a vencer', 'Sin documentos vencidos'], isCritical: [true, true] },
  ],
  PRE_PURCHASE: [
    { category: 'Identidad', items: ['Perro coincide con descripcion', 'Microchip legible y coincide', 'Raza y pedigree verificados'], isCritical: [true, true, true] },
    { category: 'Estado de Salud', items: ['Examen veterinario reciente', 'Certificado de buena salud vigente', 'Vacunacion al dia', 'Desparasitacion al dia'], isCritical: [true, true, true, true] },
    { category: 'Documentacion Entregable', items: ['Pedigree original o copia certificada', 'Cartilla de vacunacion completa', 'Contrato de venta firmado', 'Garantia sanitaria', 'Guia de cuidados post-venta'], isCritical: [true, true, true, false, false] },
    { category: 'Comportamiento', items: ['Temperamento evaluado', 'Socializacion basica verificable', 'Sin signos de miedo extremo'], isCritical: [false, false, true] },
  ],
  LITTER: [
    { category: 'Entorno', items: ['Temperatura adecuada', 'Zona limpia y sin corrientes', 'Cama comoda', 'Proteccion contra humedad'], isCritical: [true, true, false, true] },
    { category: 'Madre', items: ['Buen estado corporal', 'Lactancia activa y suficiente', 'Comportamiento maternal apropiado', 'Sin signos de mastitis'], isCritical: [true, true, true, true] },
    { category: 'Cachorros', items: ['Ganan peso regularmente', 'Ombiligos sanos', 'Ojos limpios', 'Sin deformaciones visibles', 'Activos con buen reflejo'], isCritical: [true, true, true, true, true] },
    { category: 'Documentacion', items: ['Registro de pesos', 'Fotos de identificacion', 'Desparasitacion programada'], isCritical: [false, false, false] },
  ],
  BREEDING: [
    { category: 'Reproductores', items: ['Pruebas geneticas favorables', 'Edad apropiada', 'Estado de salud optimo', 'Historial sin complicaciones'], isCritical: [true, true, true, false] },
    { category: 'Compatibilidad', items: ['COI dentro de rangos aceptables', 'Complementariedad fenotipica', 'Pruebas de compatibilidad sanguinea'], isCritical: [true, false, false] },
    { category: 'Condiciones', items: ['Instalaciones adecuadas', 'Plan de asistencia veterinaria', 'Preparacion para parto', 'Colocacion programada'], isCritical: [true, true, true, false] },
  ],
  WELFARE: [
    { category: 'Cinco Libertades', items: ['Libre de hambre y sed', 'Libre de incomodidad', 'Libre de dolor o enfermedad', 'Libre de miedo y angustia', 'Libre para expresar comportamiento normal'], isCritical: [true, true, true, true, true] },
    { category: 'Evaluacion Individual', items: ['Cada perro evaluado', 'Condicion corporal registrada', 'Comportamiento registrado'], isCritical: [true, true, false] },
    { category: 'Ambiente Social', items: ['Oportunidades de socializacion', 'Sin estres cronico', 'Manejo humano positivo'], isCritical: [false, true, false] },
  ],
  TRANSPORT: [
    { category: 'Pre-transporte', items: ['Perro apto para viaje', 'Certificado sanitario vigente', 'Vacuna rabia vigente', 'Microchip verificado'], isCritical: [true, true, true, true] },
    { category: 'Transportista', items: ['Transportista registrado', 'Vehiculo adecuado', 'Seguro vigente'], isCritical: [true, true, true] },
    { category: 'Condiciones del Viaje', items: ['Transportin apropiado', 'Ventilacion adecuada', 'Temperatura controlada', 'Acceso a agua'], isCritical: [true, true, true, false] },
    { category: 'Post-recepcion', items: ['Perro recibido en buenas condiciones', 'Documentacion firmada', 'Sin signos de estres'], isCritical: [true, true, false] },
  ],
};

function getChecklistItems(type: string): { category: string; itemText: string; order: number; isCritical: boolean }[] {
  const template = CHECKLIST_TEMPLATES[type] || CHECKLIST_TEMPLATES.HEALTH;
  let order = 0;
  const items: { category: string; itemText: string; order: number; isCritical: boolean }[] = [];
  template.forEach((group) => {
    group.items.forEach((text, idx) => {
      items.push({
        category: group.category,
        itemText: text,
        order: order++,
        isCritical: group.isCritical?.[idx] || false,
      });
    });
  });
  return items;
}

async function checkInspectionAccess(inspection: any, user: any): Promise<boolean> {
  if (user.role === 'MANAGER') return true;
  if (user.role === 'BREEDER') {
    const kennel = await prisma.kennel.findUnique({ where: { id: inspection.kennelId } });
    return kennel?.breederId === user.id;
  }
  if (user.role === 'VETERINARIAN') {
    const vet = await prisma.veterinarian.findUnique({ where: { userId: user.id } });
    const assigned = await prisma.kennelVet.findUnique({
      where: { kennelId_vetId: { kennelId: inspection.kennelId, vetId: vet?.id || '' } },
    });
    return !!assigned;
  }
  return false;
}

// List inspections
export const listInspections = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, type, status, inspectorId, dogId, litterId, dateFrom, dateTo, result } = req.query;
  const user = req.user!;

  const where: any = {};
  if (kennelId) where.kennelId = kennelId as string;
  if (type) where.type = type as string;
  if (status) where.status = status as string;
  if (inspectorId) where.inspectorId = inspectorId as string;
  if (dogId) where.dogId = dogId as string;
  if (litterId) where.litterId = litterId as string;
  if (result) where.overallResult = result as string;
  if (dateFrom || dateTo) {
    where.scheduledDate = {};
    if (dateFrom) where.scheduledDate.gte = new Date(dateFrom as string);
    if (dateTo) where.scheduledDate.lte = new Date(dateTo as string);
  }

  if (user.role === 'BREEDER') {
    const myKennels = await prisma.kennel.findMany({ where: { breederId: user.id }, select: { id: true } });
    const myKennelIds = myKennels.map((k) => k.id);
    if (kennelId && !myKennelIds.includes(kennelId as string)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!kennelId) where.kennelId = { in: myKennelIds };
  } else if (user.role === 'VETERINARIAN') {
    const vet = await prisma.veterinarian.findUnique({ where: { userId: user.id }, include: { kennels: { select: { kennelId: true } } } });
    const assignedKennelIds = vet?.kennels.map((k) => k.kennelId) || [];
    if (kennelId && !assignedKennelIds.includes(kennelId as string)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!kennelId) where.kennelId = { in: assignedKennelIds };
  }

  const inspections = await prisma.inspection.findMany({
    where,
    include: {
      kennel: { select: { id: true, name: true } },
      dog: { select: { id: true, name: true, photos: { where: { isMain: true }, take: 1 } } },
      litter: { select: { id: true, birthDate: true } },
      inspector: { select: { id: true, firstName: true, lastName: true } },
      creator: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { checklistItems: true, findings: true } },
    },
    orderBy: { scheduledDate: 'desc' },
  });

  res.json({ inspections });
});

// Get single inspection
export const getInspection = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const inspection = await prisma.inspection.findUnique({
    where: { id },
    include: {
      kennel: { select: { id: true, name: true, breederId: true } },
      dog: { select: { id: true, name: true, breedId: true, birthDate: true, status: true, photos: { where: { isMain: true }, take: 1 } } },
      litter: { select: { id: true, birthDate: true, fatherId: true, motherId: true, puppyCount: true } },
      reservation: { select: { id: true, status: true, amount: true, customer: { select: { firstName: true, lastName: true } } } },
      shipment: { select: { id: true, trackingNumber: true, status: true, carrier: { select: { name: true } } } },
      breedingPlan: { select: { id: true, name: true, plannedDate: true, fatherId: true, motherId: true } },
      inspector: { select: { id: true, firstName: true, lastName: true } },
      creator: { select: { id: true, firstName: true, lastName: true } },
      checklistItems: { orderBy: { order: 'asc' } },
      dogEvaluations: { include: { dog: { select: { id: true, name: true, breed: { select: { name: true } }, photos: { where: { isMain: true }, take: 1 } } } } },
      findings: { include: { dog: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } },
      documents: true,
      followUpTask: { select: { id: true, title: true, status: true } },
    },
  });

  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });

  const hasAccess = await checkInspectionAccess(inspection, user);
  if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

  res.json({ inspection });
});

// Create inspection
export const createInspection = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const { title, type, scheduledDate, kennelId, dogId, litterId, reservationId, shipmentId, breedingPlanId, inspectorId } = req.body;

  if (!type || !scheduledDate || !kennelId) {
    return res.status(400).json({ error: 'Type, scheduledDate and kennelId are required' });
  }

  const kennel = await prisma.kennel.findUnique({ where: { id: kennelId } });
  if (!kennel) return res.status(404).json({ error: 'Kennel not found' });

  if (user.role === 'BREEDER' && kennel.breederId !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const finalInspectorId = inspectorId || user.id;

  const inspection = await prisma.inspection.create({
    data: {
      title: title || `Inspeccion ${type}`,
      type,
      scheduledDate: new Date(scheduledDate),
      kennelId,
      dogId: dogId || null,
      litterId: litterId || null,
      reservationId: reservationId || null,
      shipmentId: shipmentId || null,
      breedingPlanId: breedingPlanId || null,
      inspectorId: finalInspectorId,
      creatorId: user.id,
      checklistItems: {
        create: getChecklistItems(type),
      },
    },
    include: {
      kennel: { select: { id: true, name: true } },
      dog: { select: { id: true, name: true } },
      inspector: { select: { id: true, firstName: true, lastName: true } },
      checklistItems: { orderBy: { order: 'asc' } },
    },
  });

  res.status(201).json({ inspection });
});

// Update inspection
export const updateInspection = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;
  const { title, scheduledDate, inspectorId } = req.body;

  const inspection = await prisma.inspection.findUnique({ where: { id }, include: { kennel: true } });
  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });

  if (inspection.status !== 'SCHEDULED') {
    return res.status(400).json({ error: 'Only scheduled inspections can be edited' });
  }

  const hasAccess = await checkInspectionAccess(inspection, user);
  if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

  if (user.role === 'BREEDER' && inspection.creatorId !== user.id) {
    return res.status(403).json({ error: 'Only the creator can edit this inspection' });
  }

  const data: any = {};
  if (title) data.title = title;
  if (scheduledDate) data.scheduledDate = new Date(scheduledDate);
  if (inspectorId) data.inspectorId = inspectorId;

  const updated = await prisma.inspection.update({
    where: { id },
    data,
    include: {
      kennel: { select: { id: true, name: true } },
      dog: { select: { id: true, name: true } },
      inspector: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  res.json({ inspection: updated });
});

// Delete inspection
export const deleteInspection = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const inspection = await prisma.inspection.findUnique({ where: { id }, include: { kennel: true } });
  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });

  if (user.role !== 'MANAGER') {
    return res.status(403).json({ error: 'Only managers can delete inspections' });
  }

  await prisma.inspection.delete({ where: { id } });
  res.json({ message: 'Inspection deleted successfully' });
});

// Start inspection
export const startInspection = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const inspection = await prisma.inspection.findUnique({ where: { id }, include: { kennel: true } });
  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });

  const hasAccess = await checkInspectionAccess(inspection, user);
  if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

  if (inspection.status !== 'SCHEDULED') {
    return res.status(400).json({ error: 'Only scheduled inspections can be started' });
  }

  const updated = await prisma.inspection.update({
    where: { id },
    data: { status: 'IN_PROGRESS', startedAt: new Date() },
    include: {
      checklistItems: { orderBy: { order: 'asc' } },
    },
  });

  res.json({ inspection: updated });
});

// Complete inspection
export const completeInspection = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;
  const { overallResult, overallScore, overallNotes, followUpDate } = req.body;

  const inspection = await prisma.inspection.findUnique({
    where: { id },
    include: { kennel: true, checklistItems: true },
  });
  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });

  const hasAccess = await checkInspectionAccess(inspection, user);
  if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

  if (inspection.status !== 'IN_PROGRESS') {
    return res.status(400).json({ error: 'Only in-progress inspections can be completed' });
  }

  // Check critical items
  const criticalItems = inspection.checklistItems.filter((i) => i.isCritical);
  const unansweredCritical = criticalItems.filter((i) => !i.result);
  if (unansweredCritical.length > 0) {
    return res.status(400).json({ error: 'All critical checklist items must be answered' });
  }

  // Calculate auto score if not provided
  let finalScore = overallScore;
  if (finalScore === undefined) {
    const answeredItems = inspection.checklistItems.filter((i) => i.result && i.result !== 'N/A');
    const passedItems = answeredItems.filter((i) => i.result === 'PASS');
    if (answeredItems.length > 0) {
      finalScore = Math.round((passedItems.length / answeredItems.length) * 100);
    }
  }

  // Update inspection
  const updated = await prisma.inspection.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      overallResult: overallResult || 'PASS',
      overallScore: finalScore,
      overallNotes: overallNotes || null,
      followUpDate: followUpDate ? new Date(followUpDate) : null,
    },
    include: {
      checklistItems: { orderBy: { order: 'asc' } },
      findings: true,
    },
  });

  // Create follow-up task if FAIL or CONDITIONAL
  if ((overallResult === 'FAIL' || overallResult === 'CONDITIONAL') && inspection.kennelId) {
    const failedCritical = criticalItems.filter((i) => i.result === 'FAIL');
    const taskTitle = `Seguimiento: ${inspection.title}`;
    const taskDesc = `Inspeccion ${inspection.type} completada con resultado ${overallResult}. ${failedCritical.length} items criticos fallaron. ${overallNotes || ''}`;

    const task = await prisma.task.create({
      data: {
        title: taskTitle,
        description: taskDesc,
        status: 'PENDING',
        priority: overallResult === 'FAIL' ? 'HIGH' : 'MEDIUM',
        dueDate: followUpDate ? new Date(followUpDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        kennelId: inspection.kennelId,
        createdBy: user.id,
        dogId: inspection.dogId,
      },
    });

    await prisma.inspection.update({
      where: { id },
      data: { followUpTaskId: task.id },
    });
  }

  res.json({ inspection: updated });
});

// Cancel inspection
export const cancelInspection = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const inspection = await prisma.inspection.findUnique({ where: { id }, include: { kennel: true } });
  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });

  const hasAccess = await checkInspectionAccess(inspection, user);
  if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

  if (inspection.status === 'COMPLETED') {
    return res.status(400).json({ error: 'Completed inspections cannot be cancelled' });
  }

  const updated = await prisma.inspection.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });

  res.json({ inspection: updated });
});

// Update checklist item
export const updateChecklistItem = asyncHandler(async (req: Request, res: Response) => {
  const { id, itemId } = req.params;
  const user = req.user!;
  const { result, notes, score, photoUrls } = req.body;

  const inspection = await prisma.inspection.findUnique({ where: { id }, include: { kennel: true } });
  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });

  if (inspection.status !== 'IN_PROGRESS') {
    return res.status(400).json({ error: 'Checklist can only be updated during inspection' });
  }

  const hasAccess = await checkInspectionAccess(inspection, user);
  if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

  const item = await prisma.inspectionChecklistItem.update({
    where: { id: itemId },
    data: { result, notes, score, photoUrls },
  });

  res.json({ item });
});

// Batch update checklist
export const batchUpdateChecklist = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;
  const { items } = req.body;

  const inspection = await prisma.inspection.findUnique({ where: { id }, include: { kennel: true } });
  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });

  if (inspection.status !== 'IN_PROGRESS') {
    return res.status(400).json({ error: 'Checklist can only be updated during inspection' });
  }

  const hasAccess = await checkInspectionAccess(inspection, user);
  if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

  const updated = await prisma.$transaction(
    items.map((item: any) =>
      prisma.inspectionChecklistItem.update({
        where: { id: item.id },
        data: { result: item.result, notes: item.notes, score: item.score },
      })
    )
  );

  res.json({ items: updated });
});

// Create dog evaluation
export const createEvaluation = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;
  const data = req.body;

  const inspection = await prisma.inspection.findUnique({ where: { id }, include: { kennel: true } });
  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });

  if (inspection.status !== 'IN_PROGRESS') {
    return res.status(400).json({ error: 'Evaluations can only be added during inspection' });
  }

  const hasAccess = await checkInspectionAccess(inspection, user);
  if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

  const evaluation = await prisma.inspectionDogEvaluation.create({
    data: { inspectionId: id, ...data },
    include: { dog: { select: { id: true, name: true, breed: { select: { name: true } } } } },
  });

  res.status(201).json({ evaluation });
});

// Update dog evaluation
export const updateEvaluation = asyncHandler(async (req: Request, res: Response) => {
  const { id, evaluationId } = req.params;
  const user = req.user!;
  const data = req.body;

  const inspection = await prisma.inspection.findUnique({ where: { id }, include: { kennel: true } });
  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });

  if (inspection.status !== 'IN_PROGRESS') {
    return res.status(400).json({ error: 'Evaluations can only be updated during inspection' });
  }

  const hasAccess = await checkInspectionAccess(inspection, user);
  if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

  const evaluation = await prisma.inspectionDogEvaluation.update({
    where: { id: evaluationId },
    data,
    include: { dog: { select: { id: true, name: true } } },
  });

  res.json({ evaluation });
});

// Delete dog evaluation
export const deleteEvaluation = asyncHandler(async (req: Request, res: Response) => {
  const { id, evaluationId } = req.params;
  const user = req.user!;

  const inspection = await prisma.inspection.findUnique({ where: { id }, include: { kennel: true } });
  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });

  if (inspection.status !== 'IN_PROGRESS') {
    return res.status(400).json({ error: 'Evaluations can only be deleted during inspection' });
  }

  const hasAccess = await checkInspectionAccess(inspection, user);
  if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

  await prisma.inspectionDogEvaluation.delete({ where: { id: evaluationId } });
  res.json({ message: 'Evaluation deleted' });
});

// Create finding
export const createFinding = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;
  const { severity, category, description, dogId, correctiveAction } = req.body;

  const inspection = await prisma.inspection.findUnique({ where: { id }, include: { kennel: true } });
  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });

  if (inspection.status !== 'IN_PROGRESS') {
    return res.status(400).json({ error: 'Findings can only be added during inspection' });
  }

  const hasAccess = await checkInspectionAccess(inspection, user);
  if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

  const finding = await prisma.inspectionFinding.create({
    data: {
      inspectionId: id,
      severity,
      category,
      description,
      dogId: dogId || null,
      correctiveAction: correctiveAction || null,
    },
    include: { dog: { select: { id: true, name: true } } },
  });

  res.status(201).json({ finding });
});

// Update finding
export const updateFinding = asyncHandler(async (req: Request, res: Response) => {
  const { id, findingId } = req.params;
  const user = req.user!;
  const data = req.body;

  const inspection = await prisma.inspection.findUnique({ where: { id }, include: { kennel: true } });
  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });

  const hasAccess = await checkInspectionAccess(inspection, user);
  if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

  const finding = await prisma.inspectionFinding.update({
    where: { id: findingId },
    data,
    include: { dog: { select: { id: true, name: true } } },
  });

  res.json({ finding });
});

// Delete finding
export const deleteFinding = asyncHandler(async (req: Request, res: Response) => {
  const { id, findingId } = req.params;
  const user = req.user!;

  const inspection = await prisma.inspection.findUnique({ where: { id }, include: { kennel: true } });
  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });

  const hasAccess = await checkInspectionAccess(inspection, user);
  if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

  await prisma.inspectionFinding.delete({ where: { id: findingId } });
  res.json({ message: 'Finding deleted' });
});

// Get inspection context
export const getInspectionContext = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const inspection = await prisma.inspection.findUnique({
    where: { id },
    include: {
      kennel: { select: { id: true, name: true, breederId: true } },
      dog: { select: { id: true, name: true, breedId: true, birthDate: true, status: true, microchip: true, photos: { where: { isMain: true }, take: 1 } } },
      litter: { select: { id: true, birthDate: true, puppyCount: true, deadPuppies: true, fatherId: true, motherId: true } },
      reservation: { select: { id: true, status: true, amount: true, deposit: true, customer: { select: { firstName: true, lastName: true, email: true } } } },
      shipment: { select: { id: true, trackingNumber: true, status: true, mode: true, scheduledDate: true, carrier: { select: { name: true, phone: true } } } },
      breedingPlan: { select: { id: true, name: true, plannedDate: true, predictedCoi: true, goal: true } },
      checklistItems: { orderBy: { order: 'asc' } },
    },
  });

  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });

  const hasAccess = await checkInspectionAccess(inspection, user);
  if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

  const context: any = {};

  // Dog-related context
  if (inspection.dogId) {
    const dogMedicalSummary = await prisma.medicalRecord.findMany({
      where: { dogId: inspection.dogId },
      orderBy: { date: 'desc' },
      take: 10,
      include: { vet: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });

    const upcomingVaccines = await prisma.medicalRecord.findMany({
      where: { dogId: inspection.dogId, type: 'VACCINE', nextDate: { gte: new Date() } },
      orderBy: { nextDate: 'asc' },
      take: 5,
    });

    const dogDocuments = await prisma.document.findMany({
      where: { dogId: inspection.dogId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    context.dogMedicalSummary = {
      recentRecords: dogMedicalSummary,
      upcomingVaccines,
      totalRecords: await prisma.medicalRecord.count({ where: { dogId: inspection.dogId } }),
    };
    context.dogDocuments = dogDocuments;
  }

  // Litter-related context
  if (inspection.litterId) {
    const puppies = await prisma.litterPuppy.findMany({
      where: { litterId: inspection.litterId },
    });
    const litter = await prisma.litter.findUnique({ where: { id: inspection.litterId } });
    const mother = await prisma.dog.findUnique({
      where: { id: litter?.motherId || '' },
      select: { id: true, name: true, status: true, photos: { where: { isMain: true }, take: 1 } },
    });
    context.puppies = puppies;
    context.mother = mother;
  }

  // Financial context
  if (inspection.type === 'FINANCIAL') {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [totalIncome, totalExpense, pendingInvoices, uncategorizedTx, lowStock] = await Promise.all([
      prisma.transaction.aggregate({ where: { kennelId: inspection.kennelId, type: 'INCOME', date: { gte: startOfMonth, lte: endOfMonth } }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { kennelId: inspection.kennelId, type: 'EXPENSE', date: { gte: startOfMonth, lte: endOfMonth } }, _sum: { amount: true } }),
      prisma.invoice.count({ where: { kennelId: inspection.kennelId, status: { in: ['PENDING', 'OVERDUE'] } } }),
      prisma.transaction.count({ where: { kennelId: inspection.kennelId, categoryId: '' } }),
      prisma.inventoryItem.findMany({ where: { kennelId: inspection.kennelId, quantity: { lte: prisma.inventoryItem.fields.minStock } } }),
    ]);

    context.financialSummary = {
      period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      totalIncome: totalIncome._sum.amount || 0,
      totalExpense: totalExpense._sum.amount || 0,
      pendingInvoices,
      uncategorizedTransactions: uncategorizedTx,
      lowStockItems: lowStock,
    };
  }

  // Facility/Welfare context
  if (inspection.type === 'FACILITY' || inspection.type === 'WELFARE') {
    const dogsInKennel = await prisma.dog.findMany({
      where: { kennelId: inspection.kennelId, status: { not: 'SOLD' } },
      select: { id: true, name: true, status: true, birthDate: true, breed: { select: { name: true } }, photos: { where: { isMain: true }, take: 1 } },
    });
    const recentMedicalAlerts = await prisma.medicalRecord.findMany({
      where: { dog: { kennelId: inspection.kennelId }, nextDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } },
      orderBy: { nextDate: 'asc' },
      take: 10,
      include: { dog: { select: { name: true } } },
    });
    context.dogsInKennel = dogsInKennel;
    context.kennelStats = { totalDogs: dogsInKennel.length };
    context.recentMedicalAlerts = recentMedicalAlerts;
  }

  // Documentary context
  if (inspection.type === 'DOCUMENTARY') {
    const missingDocs = await prisma.dog.findMany({
      where: { kennelId: inspection.kennelId, documents: { none: {} } },
      select: { id: true, name: true },
      take: 20,
    });
    const expiringSoon = await prisma.document.findMany({
      where: { kennelId: inspection.kennelId, expiryDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } },
      orderBy: { expiryDate: 'asc' },
      take: 10,
    });
    context.missingDocuments = missingDocs;
    context.expiringSoon = expiringSoon;
  }

  // Transport context
  if (inspection.shipmentId) {
    const transitDocs = await prisma.transitDocument.findMany({
      where: { shipmentId: inspection.shipmentId },
    });
    context.transitDocuments = transitDocs;
  }

  res.json({ inspection, context });
});
