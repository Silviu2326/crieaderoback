import { Router } from 'express';
import {
  getFeedingCosts,
  getFeedingCostSummary,
} from '../controllers/feedingCost.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getFeedingCosts);
router.get('/summary', getFeedingCostSummary);

export { router as feedingCostRouter };
