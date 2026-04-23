import { Router } from 'express';
import multer from 'multer';
import {
  getDogMedicalRecords,
  getMedicalRecord,
  createMedicalRecord,
  updateMedicalRecord,
  deleteMedicalRecord,
  getUpcomingAlerts,
  uploadMedicalAttachment,
} from '../controllers/medical.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticate);

router.get('/alerts', getUpcomingAlerts);
router.get('/dog/:dogId', getDogMedicalRecords);
router.get('/:id', getMedicalRecord);
router.post('/upload', authorize('MANAGER', 'VETERINARIAN'), upload.single('file'), uploadMedicalAttachment);
router.post('/', authorize('MANAGER', 'VETERINARIAN'), createMedicalRecord);
router.put('/:id', authorize('MANAGER', 'VETERINARIAN'), updateMedicalRecord);
router.delete('/:id', authorize('MANAGER', 'VETERINARIAN', 'BREEDER'), deleteMedicalRecord);

export { router as medicalRouter };
