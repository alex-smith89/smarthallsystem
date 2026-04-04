import { Router } from 'express';
import { createHall, deleteHall, getHalls, updateHall } from '../controllers/hallController.js';
import { authorize, protect } from '../middleware/authMiddleware.js';

const router = Router();

router.use(protect);
router.get('/', getHalls);
router.post('/', authorize('admin'), createHall);
router.put('/:id', authorize('admin'), updateHall);
router.delete('/:id', authorize('admin'), deleteHall);

export default router;