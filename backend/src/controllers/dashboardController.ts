import asyncHandler from 'express-async-handler';
import type { Request, Response } from 'express';
import { Attendance } from '../models/Attendance.js';
import { Exam } from '../models/Exam.js';
import { ScanLog } from '../models/ScanLog.js';
import { SeatAllocation } from '../models/SeatAllocation.js';

export const getDashboardSummary = asyncHandler(async (req: Request, res: Response) => {
  const examId = req.query.examId as string | undefined;

  if (!examId) {
    const [examCount, allocationCount, attendanceCount] = await Promise.all([
      Exam.countDocuments(),
      SeatAllocation.countDocuments(),
      Attendance.countDocuments()
    ]);

    res.json({
      success: true,
      data: {
        examCount,
        allocationCount,
        attendanceCount,
        message: 'Select a specific exam to view live hall occupancy and scan warnings'
      }
    });
    return;
  }

  const exam = await Exam.findById(examId).populate('hallIds', 'name capacity');

  if (!exam) {
    res.status(404);
    throw new Error('Exam not found');
  }

  const [allocations, attendance, recentLogs] = await Promise.all([
    SeatAllocation.find({ examId }).populate('hallId', 'name capacity'),
    Attendance.find({ examId }).populate('hallId', 'name capacity'),
    ScanLog.find({ examId })
      .populate('studentId', 'fullName rollNumber')
      .sort({ createdAt: -1 })
      .limit(10)
  ]);

  const assigned = allocations.length;
  const present = attendance.length;
  const absent = Math.max(assigned - present, 0);
  const progress = assigned === 0 ? 0 : Number(((present / assigned) * 100).toFixed(2));

  const occupancyMap = new Map<
    string,
    { hallName: string; capacity: number; assigned: number; present: number }
  >();

  for (const hall of exam.hallIds as any[]) {
    occupancyMap.set(hall._id.toString(), {
      hallName: hall.name,
      capacity: hall.capacity,
      assigned: 0,
      present: 0
    });
  }

  for (const allocation of allocations) {
    const hall = allocation.hallId as any;
    const item = occupancyMap.get(hall._id.toString());
    if (item) {
      item.assigned += 1;
    }
  }

  for (const mark of attendance) {
    const hall = mark.hallId as any;
    const item = occupancyMap.get(hall._id.toString());
    if (item) {
      item.present += 1;
    }
  }

  const warnings = recentLogs.map((log) => ({
    id: log._id,
    result: log.result,
    message: log.message,
    qrCodeValue: log.qrCodeValue,
    student: log.studentId,
    createdAt: log.createdAt
  }));

  res.json({
    success: true,
    data: {
      exam: {
        _id: exam._id,
        title: exam.title,
        subjectCode: exam.subjectCode,
        examDate: exam.examDate,
        startTime: exam.startTime,
        endTime: exam.endTime,
        status: exam.status
      },
      summary: {
        assigned,
        present,
        absent,
        progress
      },
      hallOccupancy: Array.from(occupancyMap.values()),
      warnings
    }
  });
});