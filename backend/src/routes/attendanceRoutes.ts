import { Router } from 'express';
import {
  getAttendanceByExam,
  markManualAttendance,
  scanAttendance,
  syncOfflineAttendance
} from '../controllers/attendanceController.js';
import { authorize, protect } from '../middleware/authMiddleware.js';

const router = Router();

router.use(protect);
router.post('/scan', authorize('admin', 'invigilator'), scanAttendance);
router.post('/manual', authorize('admin', 'invigilator'), markManualAttendance);
router.post('/sync-offline', authorize('admin', 'invigilator'), syncOfflineAttendance);
router.get('/exam/:examId', getAttendanceByExam);

export default router;