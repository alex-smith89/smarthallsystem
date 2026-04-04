import { Router } from 'express';
import {
  createStudent,
  deleteStudent,
  getStudents,
  updateStudent
} from '../controllers/studentController.js';
import { authorize, protect } from '../middleware/authMiddleware.js';

const router = Router();

router.use(protect);
router.get('/', getStudents);
router.post('/', authorize('admin'), createStudent);
router.put('/:id', authorize('admin'), updateStudent);
router.delete('/:id', authorize('admin'), deleteStudent);

export default router;