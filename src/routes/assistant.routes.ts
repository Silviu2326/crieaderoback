import { Router } from 'express';
import {
  chat,
  getConversations,
  getConversation,
  deleteConversation,
  saveToMedical,
} from '../controllers/assistant.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.post('/chat', chat);
router.get('/conversations', getConversations);
router.get('/conversations/:id', getConversation);
router.delete('/conversations/:id', deleteConversation);
router.post('/conversations/:id/save-to-medical', saveToMedical);

export { router as assistantRouter };
