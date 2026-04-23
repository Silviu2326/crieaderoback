import { Router } from 'express';
import { getGeneticTests, getBreedingPlans, calculateCoi } from '../controllers/genetics.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/tests', getGeneticTests);
router.get('/breeding-plans', getBreedingPlans);
router.post('/calculate-coi', calculateCoi);

export { router as geneticsRouter };
