import { Router } from 'express';
import {
  listInspections,
  getInspection,
  createInspection,
  updateInspection,
  deleteInspection,
  startInspection,
  completeInspection,
  cancelInspection,
  updateChecklistItem,
  batchUpdateChecklist,
  createEvaluation,
  updateEvaluation,
  deleteEvaluation,
  createFinding,
  updateFinding,
  deleteFinding,
  getInspectionContext,
} from '../controllers/inspection.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Main CRUD
router.get('/', listInspections);
router.get('/:id', getInspection);
router.post('/', authorize('MANAGER', 'BREEDER', 'VETERINARIAN'), createInspection);
router.put('/:id', authorize('MANAGER', 'BREEDER'), updateInspection);
router.delete('/:id', authorize('MANAGER'), deleteInspection);

// Flow endpoints
router.post('/:id/start', authorize('MANAGER', 'BREEDER', 'VETERINARIAN'), startInspection);
router.post('/:id/complete', authorize('MANAGER', 'BREEDER', 'VETERINARIAN'), completeInspection);
router.post('/:id/cancel', authorize('MANAGER', 'BREEDER'), cancelInspection);

// Checklist
router.put('/:id/checklist/:itemId', authorize('MANAGER', 'BREEDER', 'VETERINARIAN'), updateChecklistItem);
router.put('/:id/checklist/batch', authorize('MANAGER', 'BREEDER', 'VETERINARIAN'), batchUpdateChecklist);

// Evaluations
router.post('/:id/evaluations', authorize('MANAGER', 'BREEDER', 'VETERINARIAN'), createEvaluation);
router.put('/:id/evaluations/:evaluationId', authorize('MANAGER', 'BREEDER', 'VETERINARIAN'), updateEvaluation);
router.delete('/:id/evaluations/:evaluationId', authorize('MANAGER', 'BREEDER', 'VETERINARIAN'), deleteEvaluation);

// Findings
router.post('/:id/findings', authorize('MANAGER', 'BREEDER', 'VETERINARIAN'), createFinding);
router.put('/:id/findings/:findingId', authorize('MANAGER', 'BREEDER', 'VETERINARIAN'), updateFinding);
router.delete('/:id/findings/:findingId', authorize('MANAGER', 'BREEDER', 'VETERINARIAN'), deleteFinding);

// Context
router.get('/:id/context', getInspectionContext);

export { router as inspectionRouter };
