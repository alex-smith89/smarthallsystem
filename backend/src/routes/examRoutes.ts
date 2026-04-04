import { Router } from 'express';
import { createExam, deleteExam, getExams, updateExam } from '../controllers/examController.js';
import { authorize, protect } from '../middleware/authMiddleware.js';

const router = Router();

router.use(protect);
router.get('/', getExams);
router.post('/', authorize('admin'), createExam);
router.put('/:id', authorize('admin'), updateExam);
router.delete('/:id', authorize('admin'), deleteExam);

export default router;