import { Router } from 'express';
import {
  listIntolerances,
  getIntolerance,
  createIntolerance,
  updateIntolerance,
  deleteIntolerance,
  listReactions,
  createReaction,
  updateReaction,
  deleteReaction,
  checkIntoleranceAlert,
} from '../controllers/intolerance.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', listIntolerances);
router.get('/:id', getIntolerance);
router.post('/', authorize('MANAGER', 'BREEDER', 'VETERINARIAN'), createIntolerance);
router.put('/:id', authorize('MANAGER', 'BREEDER', 'VETERINARIAN'), updateIntolerance);
router.delete('/:id', authorize('MANAGER', 'BREEDER'), deleteIntolerance);

router.get('/:id/reactions', listReactions);
router.post('/:id/reactions', authorize('MANAGER', 'BREEDER', 'VETERINARIAN'), createReaction);
router.put('/reactions/:reactionId', authorize('MANAGER', 'BREEDER', 'VETERINARIAN'), updateReaction);
router.delete('/reactions/:reactionId', authorize('MANAGER', 'BREEDER'), deleteReaction);

router.post('/check', checkIntoleranceAlert);

export { router as intoleranceRouter };
