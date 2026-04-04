import asyncHandler from 'express-async-handler';
import type { Request, Response } from 'express';
import { Attendance } from '../models/Attendance.js';
import { Exam } from '../models/Exam.js';
import { ScanLog } from '../models/ScanLog.js';
import { SeatAllocation } from '../models/SeatAllocation.js';

export const getDashboardSummary = asyncHandler(async (req: Request, res: Response) => {
  const examId = req.query.examId as string | undefined;

  if (!examId) {
    const [examCount, allocationCount, attendanceCount, warningCount] = await Promise.all([
      Exam.countDocuments(),
      SeatAllocation.countDocuments(),
      Attendance.countDocuments(),
      ScanLog.countDocuments({ result: { $in: ['duplicate', 'invalid'] } })
    ]);

    res.json({
      success: true,
      data: {
        examCount,
        allocationCount,
        attendanceCount,
        warningCount,
        message: 'Select a specific exam to view live hall occupancy, seating charts, and scan warnings'
      }
    });
    return;
  }

  const exam = await Exam.findById(examId).populate('hallIds', 'name capacity rows columns seatPrefix');

  if (!exam) {
    res.status(404);
    throw new Error('Exam not found');
  }

  const [allocations, attendance, recentLogs] = await Promise.all([
    SeatAllocation.find({ examId })
      .populate('studentId', 'fullName rollNumber')
      .populate('hallId', 'name capacity rows columns'),
    Attendance.find({ examId })
      .populate('studentId', 'fullName rollNumber')
      .populate('hallId', 'name capacity')
      .populate('scannedBy', 'name role')
      .sort({ scannedAt: -1 }),
    ScanLog.find({ examId })
      .populate('studentId', 'fullName rollNumber')
      .sort({ createdAt: -1 })
      .limit(20)
  ]);

  const attendanceSet = new Set(attendance.map((item) => item.studentId._id.toString()));
  const assigned = allocations.length;
  const present = attendance.length;
  const absent = Math.max(assigned - present, 0);
  const progress = assigned === 0 ? 0 : Number(((present / assigned) * 100).toFixed(2));

  const occupancyMap = new Map<
    string,
    {
      hallId: string;
      hallName: string;
      capacity: number;
      assigned: number;
      present: number;
      vacant: number;
      occupancyPercent: number;
    }
  >();

  const seatingChartMap = new Map<
    string,
    {
      hallId: string;
      hallName: string;
      seats: Array<{
        seatNumber: string;
        row: number;
        column: number;
        studentName: string;
        rollNumber: string;
        present: boolean;
      }>;
    }
  >();

  for (const hall of exam.hallIds as any[]) {
    occupancyMap.set(hall._id.toString(), {
      hallId: hall._id.toString(),
      hallName: hall.name,
      capacity: hall.capacity,
      assigned: 0,
      present: 0,
      vacant: hall.capacity,
      occupancyPercent: 0
    });

    seatingChartMap.set(hall._id.toString(), {
      hallId: hall._id.toString(),
      hallName: hall.name,
      seats: []
    });
  }

  for (const allocation of allocations as any[]) {
    const hall = allocation.hallId;
    const hallIdValue = hall._id.toString();
    const item = occupancyMap.get(hallIdValue);
    if (item) {
      item.assigned += 1;
      item.vacant = Math.max(item.capacity - item.assigned, 0);
      item.occupancyPercent = item.capacity === 0 ? 0 : Number(((item.assigned / item.capacity) * 100).toFixed(2));
    }

    const chart = seatingChartMap.get(hallIdValue);
    if (chart) {
      chart.seats.push({
        seatNumber: allocation.seatNumber,
        row: allocation.row,
        column: allocation.column,
        studentName: allocation.studentId?.fullName || 'Unknown',
        rollNumber: allocation.studentId?.rollNumber || '-',
        present: attendanceSet.has(allocation.studentId?._id?.toString())
      });
    }
  }

  for (const mark of attendance as any[]) {
    const hall = mark.hallId;
    const item = occupancyMap.get(hall._id.toString());
    if (item) {
      item.present += 1;
    }
  }

  const scanStats = {
    valid: recentLogs.filter((log) => log.result === 'valid').length,
    duplicate: recentLogs.filter((log) => log.result === 'duplicate').length,
    invalid: recentLogs.filter((log) => log.result === 'invalid').length,
    manual: recentLogs.filter((log) => log.result === 'manual').length
  };

  const warnings = recentLogs.map((log) => ({
    id: log._id,
    result: log.result,
    message: log.message,
    qrCodeValue: log.qrCodeValue,
    student: log.studentId,
    createdAt: log.createdAt
  }));

  const recentAttendance = attendance.slice(0, 12).map((item: any) => ({
    id: item._id,
    scannedAt: item.scannedAt,
    scanMethod: item.scanMethod,
    studentName: item.studentId?.fullName || 'Unknown',
    rollNumber: item.studentId?.rollNumber || '-',
    hallName: item.hallId?.name || '-',
    scannedBy: item.scannedBy?.name || '-'
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
      scanStats,
      hallOccupancy: Array.from(occupancyMap.values()),
      seatingCharts: Array.from(seatingChartMap.values()).map((item) => ({
        ...item,
        seats: item.seats.sort((a, b) => a.row - b.row || a.column - b.column)
      })),
      recentAttendance,
      warnings
    }
  });
});