import { Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

async function checkKennelAccess(user: any, kennelId: string) {
  if (user.role === 'MANAGER') return true;
  if (user.role === 'BREEDER') {
    const kennel = await prisma.kennel.findUnique({ where: { id: kennelId }, select: { breederId: true } });
    return kennel?.breederId === user.id;
  }
  return false;
}

function formatCarrier(carrier: any) {
  if (!carrier) return carrier;
  return {
    ...carrier,
    certifications: carrier.certifications ? JSON.parse(carrier.certifications) : [],
  };
}

// ==================== CARRIERS ====================

export const listCarriers = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, search, active } = req.query;
  const user = req.user!;

  const where: any = {};
  if (kennelId) where.kennelId = kennelId as string;
  if (active !== undefined) where.active = active === 'true';
  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { contactName: { contains: search as string, mode: 'insensitive' } },
      { email: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  if (user.role === 'BREEDER') {
    const myKennels = await prisma.kennel.findMany({ where: { breederId: user.id }, select: { id: true } });
    const myKennelIds = myKennels.map(k => k.id);
    if (kennelId && !myKennelIds.includes(kennelId as string)) return res.status(403).json({ error: 'Access denied' });
    if (!kennelId) where.kennelId = { in: myKennelIds };
  }

  const carriersRaw = await prisma.carrier.findMany({ where, orderBy: { name: 'asc' } });
  const carriers = carriersRaw.map(formatCarrier);
  res.json({ carriers });
});

export const createCarrier = asyncHandler(async (req: Request, res: Response) => {
  const { name, contactName, phone, email, isCertified, certifications, rating, active, kennelId } = req.body;
  const user = req.user!;

  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const carrier = await prisma.carrier.create({
    data: {
      name,
      contactName,
      phone,
      email,
      isCertified,
      certifications: certifications ? JSON.stringify(certifications) : null,
      rating,
      active,
      kennelId,
    },
  });
  res.status(201).json({ carrier: formatCarrier(carrier) });
});

export const updateCarrier = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const existing = await prisma.carrier.findUnique({ where: { id }, select: { kennelId: true } });
  if (!existing) return res.status(404).json({ error: 'Carrier not found' });
  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, existing.kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const data: any = { ...req.body };
  if (data.certifications) data.certifications = JSON.stringify(data.certifications);

  const carrier = await prisma.carrier.update({ where: { id }, data });
  res.json({ carrier: formatCarrier(carrier) });
});

export const deleteCarrier = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const existing = await prisma.carrier.findUnique({ where: { id }, select: { kennelId: true } });
  if (!existing) return res.status(404).json({ error: 'Carrier not found' });
  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, existing.kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.carrier.delete({ where: { id } });
  res.json({ success: true });
});

// ==================== SHIPMENTS ====================

export const listShipments = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, status } = req.query;
  const user = req.user!;

  const where: any = {};
  if (kennelId) where.kennelId = kennelId as string;
  if (status) where.status = status as string;

  if (user.role === 'BREEDER') {
    const myKennels = await prisma.kennel.findMany({ where: { breederId: user.id }, select: { id: true } });
    const myKennelIds = myKennels.map(k => k.id);
    if (kennelId && !myKennelIds.includes(kennelId as string)) return res.status(403).json({ error: 'Access denied' });
    if (!kennelId) where.kennelId = { in: myKennelIds };
  }

  const shipments = await prisma.shipment.findMany({
    where,
    include: {
      carrier: { select: { id: true, name: true, rating: true } },
      dog: { select: { id: true, name: true, breed: { select: { name: true } } } },
      customer: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ shipments });
});

export const getShipmentByTracking = asyncHandler(async (req: Request, res: Response) => {
  const { trackingNumber } = req.params;
  const user = req.user!;

  const shipment = await prisma.shipment.findUnique({
    where: { trackingNumber },
    include: {
      carrier: { select: { id: true, name: true, rating: true } },
      dog: { select: { id: true, name: true, breed: { select: { name: true } } } },
      customer: { select: { id: true, firstName: true, lastName: true } },
      documents: true,
    },
  });

  if (!shipment) return res.status(404).json({ error: 'Shipment not found' });
  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, shipment.kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  res.json({ shipment });
});

export const createShipment = asyncHandler(async (req: Request, res: Response) => {
  const { trackingNumber, origin, destination, status, mode, scheduledDate, estimatedArrival, actualArrival, cost, carrierId, dogId, customerId, notes, externalTrackingUrl, kennelId } = req.body;
  const user = req.user!;

  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const shipment = await prisma.shipment.create({
    data: {
      trackingNumber,
      origin,
      destination,
      status: status || 'SCHEDULED',
      mode: mode || 'GROUND',
      scheduledDate: new Date(scheduledDate),
      estimatedArrival: estimatedArrival ? new Date(estimatedArrival) : null,
      actualArrival: actualArrival ? new Date(actualArrival) : null,
      cost,
      carrierId,
      dogId,
      customerId,
      notes,
      externalTrackingUrl,
      kennelId,
    },
  });
  res.status(201).json({ shipment });
});

export const updateShipment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const existing = await prisma.shipment.findUnique({ where: { id }, select: { kennelId: true } });
  if (!existing) return res.status(404).json({ error: 'Shipment not found' });
  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, existing.kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const data: any = { ...req.body };
  if (data.scheduledDate) data.scheduledDate = new Date(data.scheduledDate);
  if (data.estimatedArrival) data.estimatedArrival = new Date(data.estimatedArrival);
  if (data.actualArrival) data.actualArrival = new Date(data.actualArrival);

  const shipment = await prisma.shipment.update({ where: { id }, data });
  res.json({ shipment });
});

export const deleteShipment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const existing = await prisma.shipment.findUnique({ where: { id }, select: { kennelId: true } });
  if (!existing) return res.status(404).json({ error: 'Shipment not found' });
  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, existing.kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.shipment.delete({ where: { id } });
  res.json({ success: true });
});

// ==================== TRANSIT DOCUMENTS ====================

export const listTransitDocuments = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, shipmentId } = req.query;
  const user = req.user!;

  const where: any = {};
  if (kennelId) where.kennelId = kennelId as string;
  if (shipmentId) where.shipmentId = shipmentId as string;

  if (user.role === 'BREEDER') {
    const myKennels = await prisma.kennel.findMany({ where: { breederId: user.id }, select: { id: true } });
    const myKennelIds = myKennels.map(k => k.id);
    if (kennelId && !myKennelIds.includes(kennelId as string)) return res.status(403).json({ error: 'Access denied' });
    if (!kennelId) where.kennelId = { in: myKennelIds };
  }

  const documents = await prisma.transitDocument.findMany({ where, orderBy: { createdAt: 'desc' } });
  res.json({ documents });
});

export const createTransitDocument = asyncHandler(async (req: Request, res: Response) => {
  const { name, type, url, issuedDate, expiryDate, isValid, shipmentId, kennelId } = req.body;
  const user = req.user!;

  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const document = await prisma.transitDocument.create({
    data: {
      name,
      type,
      url,
      issuedDate: issuedDate ? new Date(issuedDate) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      isValid,
      shipmentId,
      kennelId,
    },
  });
  res.status(201).json({ document });
});

export const updateTransitDocument = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const existing = await prisma.transitDocument.findUnique({ where: { id }, select: { kennelId: true } });
  if (!existing) return res.status(404).json({ error: 'Document not found' });
  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, existing.kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const data: any = { ...req.body };
  if (data.issuedDate) data.issuedDate = new Date(data.issuedDate);
  if (data.expiryDate) data.expiryDate = new Date(data.expiryDate);

  const document = await prisma.transitDocument.update({ where: { id }, data });
  res.json({ document });
});

export const deleteTransitDocument = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const existing = await prisma.transitDocument.findUnique({ where: { id }, select: { kennelId: true } });
  if (!existing) return res.status(404).json({ error: 'Document not found' });
  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, existing.kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.transitDocument.delete({ where: { id } });
  res.json({ success: true });
});
