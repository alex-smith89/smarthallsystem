import { Router } from 'express';
import { getExamReport } from '../controllers/reportsController.js';
import { authorize, protect } from '../middleware/authMiddleware.js';

const router = Router();

router.use(protect);
router.get('/exam/:examId', authorize('admin', 'invigilator'), getExamReport);

export default router;