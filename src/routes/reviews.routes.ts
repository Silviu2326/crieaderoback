import { Router } from 'express';
import { getReviews, getReputation, getVerification } from '../controllers/reviews.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getReviews);
router.get('/reputation/:kennelId', getReputation);
router.get('/verification/:kennelId', getVerification);

export { router as reviewsRouter };
