import { Router } from 'express';
import {
  listNutritionPlans,
  getNutritionPlan,
  createNutritionPlan,
  updateNutritionPlan,
  deleteNutritionPlan,
  calculateRation,
  listDogNutritions,
  createDogNutrition,
  updateDogNutrition,
  deleteDogNutrition,
  getNutritionStage,
  listNutritionLogs,
  createNutritionLog,
  updateNutritionLog,
  deleteNutritionLog,
  listSupplements,
  createSupplement,
  updateSupplement,
  deleteSupplement,
} from '../controllers/nutrition.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Plans
router.get('/plans', listNutritionPlans);
router.get('/plans/:id', getNutritionPlan);
router.post('/plans', authorize('MANAGER', 'BREEDER'), createNutritionPlan);
router.put('/plans/:id', authorize('MANAGER', 'BREEDER'), updateNutritionPlan);
router.delete('/plans/:id', authorize('MANAGER', 'BREEDER'), deleteNutritionPlan);

// Calculator & stage
router.post('/calculate-ration', calculateRation);
router.get('/dog-nutritions/:id/stage', getNutritionStage);

// Dog diets
router.get('/dog-nutritions', listDogNutritions);
router.post('/dog-nutritions', authorize('MANAGER', 'BREEDER'), createDogNutrition);
router.put('/dog-nutritions/:id', authorize('MANAGER', 'BREEDER'), updateDogNutrition);
router.delete('/dog-nutritions/:id', authorize('MANAGER', 'BREEDER'), deleteDogNutrition);

// Logs
router.get('/logs', listNutritionLogs);
router.post('/logs', authorize('MANAGER', 'BREEDER'), createNutritionLog);
router.put('/logs/:id', authorize('MANAGER', 'BREEDER'), updateNutritionLog);
router.delete('/logs/:id', authorize('MANAGER', 'BREEDER'), deleteNutritionLog);

// Supplements
router.get('/supplements', listSupplements);
router.post('/supplements', authorize('MANAGER', 'BREEDER'), createSupplement);
router.put('/supplements/:id', authorize('MANAGER', 'BREEDER'), updateSupplement);
router.delete('/supplements/:id', authorize('MANAGER', 'BREEDER'), deleteSupplement);

export { router as nutritionRouter };
