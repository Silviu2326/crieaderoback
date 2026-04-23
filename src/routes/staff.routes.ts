import { Router } from 'express';
import {
  listEmployees, createEmployee, updateEmployee, deleteEmployee,
  listShifts, createShift, updateShift, deleteShift,
  listPayroll, createPayroll, updatePayroll, deletePayroll,
  listTraining, createTraining, updateTraining, deleteTraining,
} from '../controllers/staff.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Employees
router.get('/employees', listEmployees);
router.post('/employees', authorize('MANAGER', 'BREEDER'), createEmployee);
router.put('/employees/:id', authorize('MANAGER', 'BREEDER'), updateEmployee);
router.delete('/employees/:id', authorize('MANAGER', 'BREEDER'), deleteEmployee);

// Shifts
router.get('/shifts', listShifts);
router.post('/shifts', authorize('MANAGER', 'BREEDER'), createShift);
router.put('/shifts/:id', authorize('MANAGER', 'BREEDER'), updateShift);
router.delete('/shifts/:id', authorize('MANAGER', 'BREEDER'), deleteShift);

// Payroll
router.get('/payroll', listPayroll);
router.post('/payroll', authorize('MANAGER', 'BREEDER'), createPayroll);
router.put('/payroll/:id', authorize('MANAGER', 'BREEDER'), updatePayroll);
router.delete('/payroll/:id', authorize('MANAGER', 'BREEDER'), deletePayroll);

// Training
router.get('/training', listTraining);
router.post('/training', authorize('MANAGER', 'BREEDER'), createTraining);
router.put('/training/:id', authorize('MANAGER', 'BREEDER'), updateTraining);
router.delete('/training/:id', authorize('MANAGER', 'BREEDER'), deleteTraining);

export { router as staffRouter };
