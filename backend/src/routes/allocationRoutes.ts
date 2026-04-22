import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  generateAllocations,
  getAllocationsByExam,
} from '../controllers/allocationController.js';

const router = Router();

router.post('/generate', protect, generateAllocations);
router.get('/:examId', protect, getAllocationsByExam);

export default router;