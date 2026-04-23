import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listTasks,
  getTask,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  getTaskStats,
  getTaskTemplates,
  createTasksFromTemplate,
} from '../controllers/task.controller';

const router = Router();
router.use(authenticate);

router.get('/', listTasks);
router.get('/templates', getTaskTemplates);
router.post('/from-template', createTasksFromTemplate);
router.get('/stats/:kennelId', getTaskStats);
router.get('/:id', getTask);
router.post('/', createTask);
router.put('/:id', updateTask);
router.patch('/:id/status', updateTaskStatus);
router.delete('/:id', deleteTask);

export { router as taskRouter };
