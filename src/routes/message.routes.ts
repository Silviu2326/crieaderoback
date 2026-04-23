import { Router } from 'express';
import * as messageController from '../controllers/messageController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all conversations
router.get('/conversations', messageController.getConversations);

// Get unread count
router.get('/unread-count', messageController.getUnreadCount);

// Get messages with a specific user
router.get('/:userId', messageController.getMessages);

// Send a message
router.post('/', messageController.sendMessage);

// Mark messages as read
router.post('/mark-read', messageController.markAsRead);

export default router;
