import { Router } from 'express';
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  archiveCustomer,
  linkCustomer,
} from '../controllers/customer.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', listCustomers);
router.get('/:id', getCustomer);
router.post('/', authorize('MANAGER', 'BREEDER'), createCustomer);
router.put('/:id', authorize('MANAGER', 'BREEDER'), updateCustomer);
router.patch('/:id/archive', authorize('MANAGER', 'BREEDER'), archiveCustomer);
router.post('/:id/link', authorize('MANAGER', 'BREEDER'), linkCustomer);
router.delete('/:id', authorize('MANAGER', 'BREEDER'), deleteCustomer);

export { router as customerRouter };
