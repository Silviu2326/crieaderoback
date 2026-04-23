import { Router } from 'express';
import {
  listLitters,
  getLitter,
  createLitter,
  updateLitter,
  deleteLitter,
  addPuppy,
  promotePuppy,
  updatePuppy,
  deletePuppy,
} from '../controllers/litter.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', listLitters);
router.get('/:id', getLitter);
router.post('/', authorize('MANAGER', 'BREEDER'), createLitter);
router.put('/:id', authorize('MANAGER', 'BREEDER'), updateLitter);
router.delete('/:id', authorize('MANAGER', 'BREEDER'), deleteLitter);

// Puppy routes
router.post('/:id/puppies', authorize('MANAGER', 'BREEDER'), addPuppy);
router.put('/:id/puppies/:puppyId', authorize('MANAGER', 'BREEDER'), updatePuppy);
router.delete('/:id/puppies/:puppyId', authorize('MANAGER', 'BREEDER'), deletePuppy);
router.post('/:id/puppies/:puppyId/promote', authorize('MANAGER', 'BREEDER'), promotePuppy);

export { router as litterRouter };
