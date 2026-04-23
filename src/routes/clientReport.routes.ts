import { Router } from 'express';
import {
  listClientReports,
  getClientReport,
  generateReport,
  updateReport,
  finalizeReport,
  deleteReport,
} from '../controllers/clientReport.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', listClientReports);
router.get('/:id', getClientReport);
router.post('/', authorize('MANAGER', 'BREEDER'), generateReport);
router.put('/:id', authorize('MANAGER', 'BREEDER'), updateReport);
router.patch('/:id/finalize', authorize('MANAGER', 'BREEDER'), finalizeReport);
router.delete('/:id', authorize('MANAGER', 'BREEDER'), deleteReport);

export { router as clientReportRouter };
