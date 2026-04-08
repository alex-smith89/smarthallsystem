import asyncHandler from 'express-async-handler';
import type { Request, Response } from 'express';
import { Attendance } from '../models/Attendance.js';
import { Exam } from '../models/Exam.js';
import { ScanLog } from '../models/ScanLog.js';
import { SeatAllocation } from '../models/SeatAllocation.js';
import { Student } from '../models/Student.js';
import { Hall } from '../models/Hall.js';

export const getDashboardSummary = asyncHandler(async (_req: Request, res: Response) => {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const [
    totalStudents,
    activeStudents,
    totalHalls,
    totalExams,
    todayExams,
    todaySeatAllocations,
    todayPresent,
    recentLogs,
    scanStatsRaw
  ] = await Promise.all([
    Student.countDocuments(),
    Student.countDocuments({ isActive: true }),
    Hall.countDocuments(),
    Exam.countDocuments(),
    Exam.find({ examDate: today }).sort({ startTime: 1 }),
    SeatAllocation.countDocuments({ examDate: today }),
    Attendance.countDocuments({ examDate: today }),
    ScanLog.find().sort({ createdAt: -1 }).limit(8).populate('studentId', 'fullName rollNumber'),
    ScanLog.aggregate([
      {
        $group: {
          _id: '$result',
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  const scanStats = scanStatsRaw.reduce<Record<string, number>>((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  const scansTodayLogs = await ScanLog.countDocuments({
    createdAt: {
      $gte: new Date(`${today}T00:00:00.000Z`),
      $lte: new Date(`${today}T23:59:59.999Z`)
    }
  });

  const duplicateScans = Number(scanStats.duplicate || 0);
  const invalidScans = Number(scanStats.invalid || 0);
  const manualScans = Number(scanStats.manual || 0);
  const validQrScans = Number(scanStats.valid || 0);
  const scansToday = scansTodayLogs || todayPresent + duplicateScans + invalidScans + manualScans + validQrScans;

  const attendanceRate = todaySeatAllocations
    ? Number(((todayPresent / todaySeatAllocations) * 100).toFixed(1))
    : 0;

  const hallOccupancy = todayExams.map((exam) => ({
    examId: exam._id,
    title: exam.title,
    subjectCode: exam.subjectCode,
    allocated: 0,
    present: 0
  }));

  for (const item of hallOccupancy) {
    item.allocated = await SeatAllocation.countDocuments({ examId: item.examId });
    item.present = await Attendance.countDocuments({ examId: item.examId });
  }

  res.json({
    success: true,
    data: {
      cards: {
        totalStudents,
        activeStudents,
        totalHalls,
        totalExams,
        todayExams: todayExams.length,
        todaySeatAllocations,
        todayPresent,
        scansToday,
        attendanceRate
      },
      scans: {
        valid: validQrScans,
        invalid: invalidScans,
        duplicate: duplicateScans,
        manual: manualScans
      },
      todayExams,
      hallOccupancy,
      recentLogs
    }
  });
});

export const getExamDashboard = asyncHandler(async (req: Request, res: Response) => {
  const exam = await Exam.findById(req.params.examId)
    .populate('hallIds', 'name building capacity rows columns')
    .populate('studentIds', 'fullName rollNumber program semester');

  if (!exam) {
    res.status(404);
    throw new Error('Exam not found');
  }

  const [allocations, attendance, logs] = await Promise.all([
    SeatAllocation.find({ examId: exam._id })
      .populate('studentId', 'fullName rollNumber program semester')
      .populate('hallId', 'name building floor'),
    Attendance.find({ examId: exam._id })
      .populate('studentId', 'fullName rollNumber program semester')
      .populate('hallId', 'name building floor')
      .populate('scannedBy', 'name role')
      .sort({ scannedAt: -1 }),
    ScanLog.find({ examId: exam._id })
      .populate('studentId', 'fullName rollNumber')
      .sort({ createdAt: -1 })
      .limit(20)
  ]);

  const presentCount = attendance.length;
  const allocatedCount = allocations.length;
  const absentCount = Math.max(allocatedCount - presentCount, 0);
  const attendanceRate = allocatedCount
    ? Number(((presentCount / allocatedCount) * 100).toFixed(1))
    : 0;

  const byHall = allocations.reduce<Record<string, { hallName: string; allocated: number; present: number }>>(
    (acc, allocation) => {
      const hallId = allocation.hallId?._id?.toString() || 'unknown';
      const hallName = (allocation.hallId as { name?: string })?.name || 'Unknown Hall';

      if (!acc[hallId]) {
        acc[hallId] = { hallName, allocated: 0, present: 0 };
      }

      acc[hallId].allocated += 1;
      return acc;
    },
    {}
  );

  attendance.forEach((record) => {
    const hallId = record.hallId?._id?.toString() || 'unknown';
    if (!byHall[hallId]) {
      const hallName = (record.hallId as { name?: string })?.name || 'Unknown Hall';
      byHall[hallId] = { hallName, allocated: 0, present: 0 };
    }
    byHall[hallId].present += 1;
  });

  res.json({
    success: true,
    data: {
      exam,
      summary: {
        allocatedCount,
        presentCount,
        absentCount,
        attendanceRate
      },
      byHall: Object.values(byHall),
      allocations,
      attendance,
      logs
    }
  });
});