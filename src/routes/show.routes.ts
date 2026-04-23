import { Router } from 'express';
import {
  listShows, getShow, createShow, updateShow, deleteShow,
  listShowDogs, listAllShowDogs, createShowDog, updateShowDog, deleteShowDog,
  listShowResults, listAllShowResults, createShowResult, updateShowResult, deleteShowResult,
  listShowBudget, listAllShowBudget, createShowBudgetItem, updateShowBudgetItem, deleteShowBudgetItem,
} from '../controllers/show.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Show events
router.get('/', listShows);
router.post('/', authorize('MANAGER', 'BREEDER'), createShow);

// Global lists (must be before /:id routes)
router.get('/dogs', listAllShowDogs);
router.get('/results', listAllShowResults);
router.get('/budget', listAllShowBudget);

// Show events by id
router.get('/:id', getShow);
router.put('/:id', authorize('MANAGER', 'BREEDER'), updateShow);
router.delete('/:id', authorize('MANAGER', 'BREEDER'), deleteShow);

// Show dogs
router.get('/:id/dogs', listShowDogs);
router.post('/:id/dogs', authorize('MANAGER', 'BREEDER'), createShowDog);
router.put('/:id/dogs/:showDogId', authorize('MANAGER', 'BREEDER'), updateShowDog);
router.delete('/:id/dogs/:showDogId', authorize('MANAGER', 'BREEDER'), deleteShowDog);

// Show results
router.get('/:id/results', listShowResults);
router.post('/:id/results', authorize('MANAGER', 'BREEDER'), createShowResult);
router.put('/:id/results/:resultId', authorize('MANAGER', 'BREEDER'), updateShowResult);
router.delete('/:id/results/:resultId', authorize('MANAGER', 'BREEDER'), deleteShowResult);

// Show budget
router.get('/:id/budget', listShowBudget);
router.post('/:id/budget', authorize('MANAGER', 'BREEDER'), createShowBudgetItem);
router.put('/:id/budget/:itemId', authorize('MANAGER', 'BREEDER'), updateShowBudgetItem);
router.delete('/:id/budget/:itemId', authorize('MANAGER', 'BREEDER'), deleteShowBudgetItem);

export { router as showRouter };
