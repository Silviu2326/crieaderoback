import { Router } from 'express';
import {
  listRecipes,
  getRecipe,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  calculateRecipeCost,
} from '../controllers/recipe.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', listRecipes);
router.get('/:id', getRecipe);
router.post('/', authorize('MANAGER', 'BREEDER'), createRecipe);
router.put('/:id', authorize('MANAGER', 'BREEDER'), updateRecipe);
router.delete('/:id', authorize('MANAGER', 'BREEDER'), deleteRecipe);
router.get('/:id/cost', calculateRecipeCost);

export { router as recipeRouter };
