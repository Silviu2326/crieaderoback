import { Router } from 'express';
import {
  listReservations,
  getReservation,
  createReservation,
  updateReservationStatus,
  cancelReservation,
  deleteReservation,
} from '../controllers/reservation.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', listReservations);
router.get('/:id', getReservation);
router.post('/', createReservation);
router.put('/:id', updateReservationStatus);
router.patch('/:id/cancel', cancelReservation);
router.delete('/:id', deleteReservation);

export { router as reservationRouter };
