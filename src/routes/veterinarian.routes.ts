import { Router } from 'express';
import {
  getMyKennels,
  getKennelDogs,
  getMyProfile,
  updateMyProfile,
  getUpcomingVaccines,
} from '../controllers/veterinarian.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate, authorize('VETERINARIAN'));

router.get('/profile', getMyProfile);
router.put('/profile', updateMyProfile);
router.get('/kennels', getMyKennels);
router.get('/kennels/:kennelId/dogs', getKennelDogs);
router.get('/upcoming-vaccines', getUpcomingVaccines);

export { router as veterinarianRouter };
