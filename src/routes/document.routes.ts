import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import {
  listDocuments,
  getDocument,
  uploadDocument,
  updateDocument,
  deleteDocument,
  downloadDocument,
  generateContract,
  generatePedigree,
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from '../controllers/document.controller';

const router = Router();

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// All routes require authentication
router.use(authenticate);

// Document routes
router.get('/', listDocuments);
router.get('/templates', listTemplates);
router.post('/templates', createTemplate);
router.put('/templates/:id', updateTemplate);
router.delete('/templates/:id', deleteTemplate);

router.post('/upload', upload.single('file'), uploadDocument);
router.post('/generate-contract', generateContract);
router.post('/generate-pedigree', generatePedigree);

router.get('/:id', getDocument);
router.get('/:id/download', downloadDocument);
router.put('/:id', updateDocument);
router.delete('/:id', deleteDocument);

export { router as documentRouter };
