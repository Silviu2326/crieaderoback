import { Router } from 'express';
import {
  getPublicKennel,
  getPublicDog,
  listPublicKennels,
} from '../controllers/public.controller';
import { optionalAuth } from '../middleware/auth';

const router = Router();

// All public routes have optional auth
router.use(optionalAuth);

router.get('/kennels', listPublicKennels);
router.get('/kennels/:slug', getPublicKennel);
router.get('/kennels/:slug/dogs/:dogId', getPublicDog);

export { router as publicRouter };
