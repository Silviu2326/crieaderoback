import { Router } from 'express';
import {
  listDogs,
  getDog,
  createDog,
  updateDog,
  toggleVisibility,
  deleteDog,
  addPhotos,
  removePhoto,
  setMainPhoto,
  getAvailableParents,
  getPedigree,
} from '../controllers/dog.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/parents', getAvailableParents);
router.get('/', listDogs);
router.get('/:id', getDog);
router.get('/:id/pedigree', getPedigree);
router.post('/', authorize('MANAGER', 'BREEDER'), createDog);
router.put('/:id', authorize('MANAGER', 'BREEDER'), updateDog);
router.patch('/:id/toggle-visibility', authorize('MANAGER', 'BREEDER'), toggleVisibility);
router.delete('/:id', authorize('MANAGER', 'BREEDER'), deleteDog);
router.post('/:id/photos', authorize('MANAGER', 'BREEDER'), addPhotos);
router.delete('/:id/photos/:photoId', authorize('MANAGER', 'BREEDER'), removePhoto);
router.patch('/:id/photos/:photoId/main', authorize('MANAGER', 'BREEDER'), setMainPhoto);

export { router as dogRouter };
