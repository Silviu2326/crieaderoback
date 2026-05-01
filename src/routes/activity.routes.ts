import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getActivity } from '../controllers/activity.controller';

const router = Router();
router.use(authenticate);

router.get('/', getActivity);

export { router as activityRouter };
