import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  toggleStatus,
  getUpcomingEvents,
  getEventsByRange,
  createFromMedical,
} from '../controllers/calendar.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Calendar event routes
router.get('/', listEvents);
router.get('/upcoming', getUpcomingEvents);
router.get('/range', getEventsByRange);
router.post('/', createEvent);
router.post('/from-medical', createFromMedical);
router.get('/:id', getEvent);
router.put('/:id', updateEvent);
router.patch('/:id/toggle-status', toggleStatus);
router.delete('/:id', deleteEvent);

export { router as calendarRouter };
