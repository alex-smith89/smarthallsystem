import asyncHandler from 'express-async-handler';
import type { Request, Response } from 'express';
import { Attendance } from '../models/Attendance.js';
import { Exam } from '../models/Exam.js';
import { ScanLog } from '../models/ScanLog.js';
import { SeatAllocation } from '../models/SeatAllocation.js';
import { Student } from '../models/Student.js';
import { getIO } from '../socket.js';
import { parseQrPayload } from '../utils/qr.js';

type MarkAttendanceArgs = {
  examId: string;
  studentId: string;
  qrCodeValue: string;
  scanMethod: 'qr' | 'manual' | 'offline-sync';
  scannedBy: string;
  notes?: string;
};

async function markAttendanceInternal({
  examId,
  studentId,
  qrCodeValue,
  scanMethod,
  scannedBy,
  notes
}: MarkAttendanceArgs) {
  const allocation = await SeatAllocation.findOne({ examId, studentId }).populate('hallId', 'name');

  if (!allocation) {
    throw new Error('Student is not allocated to this exam');
  }

  const existingAttendance = await Attendance.findOne({ examId, studentId });

  if (existingAttendance) {
    await ScanLog.create({
      examId,
      studentId,
      hallId: allocation.hallId,
      qrCodeValue,
      result: 'duplicate',
      message: 'Duplicate QR scan detected for this student',
      scannedBy
    });

    getIO().emit('dashboard:updated', {
      examId,
      type: 'duplicate-scan',
      studentId
    });

    return {
      warning: true,
      message: 'Duplicate scan detected. Attendance was already marked.',
      attendance: existingAttendance
    };
  }

  const attendance = await Attendance.create({
    examId,
    studentId,
    hallId: allocation.hallId,
    seatAllocationId: allocation._id,
    qrCodeValue,
    scanMethod,
    scannedBy,
    notes,
    status: 'present'
  });

  await ScanLog.create({
    examId,
    studentId,
    hallId: allocation.hallId,
    qrCodeValue,
    result: scanMethod === 'manual' ? 'manual' : 'valid',
    message: scanMethod === 'manual' ? 'Attendance marked manually' : 'Attendance marked successfully',
    scannedBy
  });

  getIO().emit('dashboard:updated', {
    examId,
    type: 'attendance-marked',
    studentId
  });

  return {
    warning: false,
    message: 'Attendance marked successfully',
    attendance
  };
}

export const scanAttendance = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401);
    throw new Error('Not authorized');
  }

  const { examId, qrCodeValue } = req.body as { examId?: string; qrCodeValue?: string };

  if (!examId || !qrCodeValue) {
    res.status(400);
    throw new Error('examId and qrCodeValue are required');
  }

  const exam = await Exam.findById(examId);
  if (!exam) {
    res.status(404);
    throw new Error('Exam not found');
  }

  const parsed = parseQrPayload(qrCodeValue);
  if (!parsed?.studentId) {
    await ScanLog.create({
      examId,
      qrCodeValue,
      result: 'invalid',
      message: 'Invalid QR payload received',
      scannedBy: req.user._id
    });

    getIO().emit('dashboard:updated', { examId, type: 'invalid-scan' });

    res.status(400);
    throw new Error('Invalid QR code');
  }

  if (parsed.examId && parsed.examId !== examId) {
    await ScanLog.create({
      examId,
      qrCodeValue,
      result: 'invalid',
      message: 'QR belongs to a different exam',
      scannedBy: req.user._id
    });

    getIO().emit('dashboard:updated', { examId, type: 'invalid-scan' });

    res.status(400);
    throw new Error('This QR code belongs to a different exam');
  }

  const student = await Student.findById(parsed.studentId);

  if (!student) {
    await ScanLog.create({
      examId,
      qrCodeValue,
      result: 'invalid',
      message: 'QR belongs to an unknown student',
      scannedBy: req.user._id
    });

    getIO().emit('dashboard:updated', { examId, type: 'invalid-scan' });

    res.status(404);
    throw new Error('Student from QR code was not found');
  }

  const result = await markAttendanceInternal({
    examId,
    studentId: student._id.toString(),
    qrCodeValue,
    scanMethod: 'qr',
    scannedBy: req.user._id.toString()
  });

  const populatedAttendance = await Attendance.findById(result.attendance._id)
    .populate('studentId', 'fullName rollNumber program semester')
    .populate('hallId', 'name building floor')
    .populate('scannedBy', 'name role');

  res.json({
    success: true,
    warning: result.warning,
    message: result.message,
    data: populatedAttendance
  });
});

export const markManualAttendance = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401);
    throw new Error('Not authorized');
  }

  const { examId, studentId, notes } = req.body as {
    examId?: string;
    studentId?: string;
    notes?: string;
  };

  if (!examId || !studentId) {
    res.status(400);
    throw new Error('examId and studentId are required');
  }

  const student = await Student.findById(studentId);
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }

  const result = await markAttendanceInternal({
    examId,
    studentId,
    qrCodeValue: student.qrCodeValue,
    scanMethod: 'manual',
    scannedBy: req.user._id.toString(),
    notes
  });

  const populatedAttendance = await Attendance.findById(result.attendance._id)
    .populate('studentId', 'fullName rollNumber program semester')
    .populate('hallId', 'name building floor')
    .populate('scannedBy', 'name role');

  res.json({
    success: true,
    warning: result.warning,
    message: result.message,
    data: populatedAttendance
  });
});

export const syncOfflineAttendance = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401);
    throw new Error('Not authorized');
  }

  const { examId, qrCodeValues } = req.body as {
    examId?: string;
    qrCodeValues?: string[];
  };

  if (!examId || !qrCodeValues?.length) {
    res.status(400);
    throw new Error('examId and qrCodeValues are required');
  }

  const results: Array<{ qrCodeValue: string; success: boolean; message: string }> = [];

  for (const qrCodeValue of qrCodeValues) {
    const parsed = parseQrPayload(qrCodeValue);

    if (!parsed?.studentId) {
      results.push({ qrCodeValue, success: false, message: 'Invalid QR payload' });
      continue;
    }

    try {
      const result = await markAttendanceInternal({
        examId,
        studentId: parsed.studentId,
        qrCodeValue,
        scanMethod: 'offline-sync',
        scannedBy: req.user._id.toString()
      });

      results.push({ qrCodeValue, success: true, message: result.message });
    } catch (error) {
      results.push({
        qrCodeValue,
        success: false,
        message: error instanceof Error ? error.message : 'Unknown sync failure'
      });
    }
  }

  res.json({ success: true, count: results.length, data: results });
});

export const getAttendanceByExam = asyncHandler(async (req: Request, res: Response) => {
  const attendance = await Attendance.find({ examId: req.params.examId })
    .populate('studentId', 'fullName rollNumber program semester')
    .populate('hallId', 'name building floor')
    .populate('scannedBy', 'name role')
    .sort({ scannedAt: -1 });

  const logs = await ScanLog.find({ examId: req.params.examId })
    .populate('studentId', 'fullName rollNumber')
    .sort({ createdAt: -1 })
    .limit(20);

  res.json({ success: true, data: { attendance, logs } });
});