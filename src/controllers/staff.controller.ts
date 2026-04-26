import { Request, Response } from 'express';
import prisma from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

async function checkKennelAccess(user: any, kennelId: string) {
  if (user.role === 'MANAGER') return true;
  if (user.role === 'BREEDER') {
    return kennelId === user.kennelId;
  }
  return false;
}

// ==================== EMPLOYEES ====================

export const listEmployees = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, role, status } = req.query;
  const user = req.user!;

  const where: any = {};
  if (kennelId) where.kennelId = kennelId as string;
  if (role) where.role = role as string;
  if (status) where.status = status as string;

  if (user.role === 'BREEDER') {
    const effectiveKennelId = (kennelId as string) || user.kennelId;
    if (effectiveKennelId !== user.kennelId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!kennelId) {
      where.kennelId = user.kennelId;
    }
  }

  const employees = await prisma.employee.findMany({ where, orderBy: { createdAt: 'desc' } });
  res.json({ employees });
});

export const createEmployee = asyncHandler(async (req: Request, res: Response) => {
  const { firstName, lastName, email, phone, role, status, hourlyRate, hireDate, kennelId } = req.body;
  const user = req.user!;

  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const employee = await prisma.employee.create({
    data: { firstName, lastName, email, phone, role, status, hourlyRate, hireDate: new Date(hireDate), kennelId },
  });
  res.status(201).json({ employee });
});

export const updateEmployee = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const existing = await prisma.employee.findUnique({ where: { id }, select: { kennelId: true } });
  if (!existing) return res.status(404).json({ error: 'Employee not found' });
  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, existing.kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const data: any = { ...req.body };
  if (data.hireDate) data.hireDate = new Date(data.hireDate);

  const employee = await prisma.employee.update({ where: { id }, data });
  res.json({ employee });
});

export const deleteEmployee = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const existing = await prisma.employee.findUnique({ where: { id }, select: { kennelId: true } });
  if (!existing) return res.status(404).json({ error: 'Employee not found' });
  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, existing.kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.employee.delete({ where: { id } });
  res.json({ success: true });
});

// ==================== SHIFTS ====================

export const listShifts = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, employeeId, dateFrom, dateTo } = req.query;
  const user = req.user!;

  const where: any = {};
  if (kennelId) where.kennelId = kennelId as string;
  if (employeeId) where.employeeId = employeeId as string;
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom as string);
    if (dateTo) where.date.lte = new Date(dateTo as string);
  }

  if (user.role === 'BREEDER') {
    const effectiveKennelId = (kennelId as string) || user.kennelId;
    if (effectiveKennelId !== user.kennelId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!kennelId) {
      where.kennelId = user.kennelId;
    }
  }

  const shifts = await prisma.shift.findMany({
    where,
    include: { employee: { select: { id: true, firstName: true, lastName: true, role: true } } },
    orderBy: { date: 'desc' },
  });
  res.json({ shifts });
});

export const createShift = asyncHandler(async (req: Request, res: Response) => {
  const { employeeId, date, startTime, endTime, type, notes, kennelId } = req.body;
  const user = req.user!;

  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const shift = await prisma.shift.create({
    data: { employeeId, date: new Date(date), startTime, endTime, type, notes, kennelId },
  });
  res.status(201).json({ shift });
});

export const updateShift = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const existing = await prisma.shift.findUnique({ where: { id }, select: { kennelId: true } });
  if (!existing) return res.status(404).json({ error: 'Shift not found' });
  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, existing.kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const data: any = { ...req.body };
  if (data.date) data.date = new Date(data.date);

  const shift = await prisma.shift.update({ where: { id }, data });
  res.json({ shift });
});

export const deleteShift = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const existing = await prisma.shift.findUnique({ where: { id }, select: { kennelId: true } });
  if (!existing) return res.status(404).json({ error: 'Shift not found' });
  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, existing.kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.shift.delete({ where: { id } });
  res.json({ success: true });
});

// ==================== PAYROLL ====================

export const listPayroll = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, employeeId, status } = req.query;
  const user = req.user!;

  const where: any = {};
  if (kennelId) where.kennelId = kennelId as string;
  if (employeeId) where.employeeId = employeeId as string;
  if (status) where.status = status as string;

  if (user.role === 'BREEDER') {
    const effectiveKennelId = (kennelId as string) || user.kennelId;
    if (effectiveKennelId !== user.kennelId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!kennelId) {
      where.kennelId = user.kennelId;
    }
  }

  const payroll = await prisma.payrollEntry.findMany({
    where,
    include: { employee: { select: { id: true, firstName: true, lastName: true, role: true } } },
    orderBy: { periodStart: 'desc' },
  });
  res.json({ payroll });
});

export const createPayroll = asyncHandler(async (req: Request, res: Response) => {
  const { employeeId, periodStart, periodEnd, regularHours, overtimeHours, hourlyRate, overtimeRate, bonus, deductions, totalPay, status, paidAt, kennelId } = req.body;
  const user = req.user!;

  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const payroll = await prisma.payrollEntry.create({
    data: {
      employeeId,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      regularHours,
      overtimeHours,
      hourlyRate,
      overtimeRate,
      bonus,
      deductions,
      totalPay,
      status: status || 'DRAFT',
      paidAt: paidAt ? new Date(paidAt) : null,
      kennelId,
    },
  });
  res.status(201).json({ payroll });
});

export const updatePayroll = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const existing = await prisma.payrollEntry.findUnique({ where: { id }, select: { kennelId: true } });
  if (!existing) return res.status(404).json({ error: 'Payroll entry not found' });
  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, existing.kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const data: any = { ...req.body };
  if (data.periodStart) data.periodStart = new Date(data.periodStart);
  if (data.periodEnd) data.periodEnd = new Date(data.periodEnd);
  if (data.paidAt) data.paidAt = new Date(data.paidAt);

  const payroll = await prisma.payrollEntry.update({ where: { id }, data });
  res.json({ payroll });
});

export const deletePayroll = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const existing = await prisma.payrollEntry.findUnique({ where: { id }, select: { kennelId: true } });
  if (!existing) return res.status(404).json({ error: 'Payroll entry not found' });
  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, existing.kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.payrollEntry.delete({ where: { id } });
  res.json({ success: true });
});

// ==================== TRAINING ====================

export const listTraining = asyncHandler(async (req: Request, res: Response) => {
  const { kennelId, employeeId } = req.query;
  const user = req.user!;

  const where: any = {};
  if (kennelId) where.kennelId = kennelId as string;
  if (employeeId) where.employeeId = employeeId as string;

  if (user.role === 'BREEDER') {
    const effectiveKennelId = (kennelId as string) || user.kennelId;
    if (effectiveKennelId !== user.kennelId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!kennelId) {
      where.kennelId = user.kennelId;
    }
  }

  const courses = await prisma.trainingCourse.findMany({
    where,
    include: { employee: { select: { id: true, firstName: true, lastName: true, role: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ courses });
});

export const createTraining = asyncHandler(async (req: Request, res: Response) => {
  const { employeeId, name, provider, completedDate, expiryDate, certificateUrl, status, kennelId } = req.body;
  const user = req.user!;

  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const course = await prisma.trainingCourse.create({
    data: {
      employeeId,
      name,
      provider,
      completedDate: completedDate ? new Date(completedDate) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      certificateUrl,
      status: status || 'PENDING',
      kennelId,
    },
  });
  res.status(201).json({ course });
});

export const updateTraining = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const existing = await prisma.trainingCourse.findUnique({ where: { id }, select: { kennelId: true } });
  if (!existing) return res.status(404).json({ error: 'Training course not found' });
  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, existing.kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const data: any = { ...req.body };
  if (data.completedDate) data.completedDate = new Date(data.completedDate);
  if (data.expiryDate) data.expiryDate = new Date(data.expiryDate);

  const course = await prisma.trainingCourse.update({ where: { id }, data });
  res.json({ course });
});

export const deleteTraining = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const existing = await prisma.trainingCourse.findUnique({ where: { id }, select: { kennelId: true } });
  if (!existing) return res.status(404).json({ error: 'Training course not found' });
  if (user.role === 'BREEDER' && !(await checkKennelAccess(user, existing.kennelId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.trainingCourse.delete({ where: { id } });
  res.json({ success: true });
});
