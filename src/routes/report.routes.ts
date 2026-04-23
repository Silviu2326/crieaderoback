import { Router } from 'express';
import {
  getKennelReport,
  getManagerReport,
  getSalesReport,
  getBreedReport,
} from '../controllers/report.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/kennel', getKennelReport);
router.get('/manager', authorize('MANAGER'), getManagerReport);
router.get('/sales', getSalesReport);
router.get('/breeds', getBreedReport);

export { router as reportRouter };
