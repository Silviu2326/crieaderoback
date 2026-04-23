import { Router } from 'express';
import {
  listCarriers, createCarrier, updateCarrier, deleteCarrier,
  listShipments, getShipmentByTracking, createShipment, updateShipment, deleteShipment,
  listTransitDocuments, createTransitDocument, updateTransitDocument, deleteTransitDocument,
} from '../controllers/logistics.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Carriers
router.get('/carriers', listCarriers);
router.post('/carriers', authorize('MANAGER', 'BREEDER'), createCarrier);
router.put('/carriers/:id', authorize('MANAGER', 'BREEDER'), updateCarrier);
router.delete('/carriers/:id', authorize('MANAGER', 'BREEDER'), deleteCarrier);

// Shipments
router.get('/shipments', listShipments);
router.get('/shipments/tracking/:trackingNumber', getShipmentByTracking);
router.post('/shipments', authorize('MANAGER', 'BREEDER'), createShipment);
router.put('/shipments/:id', authorize('MANAGER', 'BREEDER'), updateShipment);
router.delete('/shipments/:id', authorize('MANAGER', 'BREEDER'), deleteShipment);

// Transit Documents
router.get('/documents', listTransitDocuments);
router.post('/documents', authorize('MANAGER', 'BREEDER'), createTransitDocument);
router.put('/documents/:id', authorize('MANAGER', 'BREEDER'), updateTransitDocument);
router.delete('/documents/:id', authorize('MANAGER', 'BREEDER'), deleteTransitDocument);

export { router as logisticsRouter };
