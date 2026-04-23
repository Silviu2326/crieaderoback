import { Router } from 'express';
import { body } from 'express-validator';
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  toggleUserStatus,
  deleteUser,
  getVeterinarians,
} from '../controllers/user.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All routes require authentication and MANAGER role
router.use(authenticate, authorize('MANAGER'));

router.get('/', listUsers);
router.get('/veterinarians', getVeterinarians);
router.get('/:id', getUser);
router.post('/', [
  body('email').isEmail(),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('role').isIn(['MANAGER', 'BREEDER', 'VETERINARIAN']),
], createUser);
router.put('/:id', updateUser);
router.patch('/:id/toggle-status', toggleUserStatus);
router.delete('/:id', deleteUser);

export { router as userRouter };
