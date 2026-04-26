import { Router } from 'express';
import { body } from 'express-validator';
import {
  listKennels,
  getKennel,
  createKennel,
  updateKennel,
  toggleKennelStatus,
  getKennelStats,
  getMyKennel,
} from '../controllers/kennel.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/my-kennel', authorize('MANAGER', 'BREEDER'), getMyKennel);
router.get('/', listKennels);
router.get('/:id/stats', getKennelStats);
router.get('/:id', getKennel);
router.post('/', authorize('MANAGER'), [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('breederId').notEmpty().withMessage('Breeder is required'),
], createKennel);
router.put('/:id', updateKennel);
router.patch('/:id/toggle-status', authorize('MANAGER'), toggleKennelStatus);

export { router as kennelRouter };
