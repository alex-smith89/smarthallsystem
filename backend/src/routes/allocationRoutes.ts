import { Router } from 'express';
import { generateAllocations, getAllocationsByExam } from '../controllers/allocationController.js';
import { authorize, protect } from '../middleware/authMiddleware.js';

const router = Router();

router.use(protect);
router.post('/generate', authorize('admin'), generateAllocations);
router.get('/exam/:examId', getAllocationsByExam);

export default router;