import { Router } from 'express';
import {
  listBreeds,
  getBreed,
  createBreed,
  updateBreed,
  toggleBreedStatus,
  getBreedGroups,
} from '../controllers/breed.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/groups', getBreedGroups);
router.get('/', listBreeds);
router.get('/:id', getBreed);

// Manager only routes
router.post('/', authenticate, authorize('MANAGER'), createBreed);
router.put('/:id', authenticate, authorize('MANAGER'), updateBreed);
router.patch('/:id/toggle-status', authenticate, authorize('MANAGER'), toggleBreedStatus);

export { router as breedRouter };
