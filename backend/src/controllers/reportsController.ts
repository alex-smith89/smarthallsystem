import asyncHandler from 'express-async-handler';
import type { Request, Response } from 'express';
import { Attendance } from '../models/Attendance.js';
import { Exam } from '../models/Exam.js';
import { ScanLog } from '../models/ScanLog.js';
import { SeatAllocation } from '../models/SeatAllocation.js';

function csvEscape(value: unknown): string {
  const raw = String(value ?? '');
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export const getExamReport = asyncHandler(async (req: Request, res: Response) => {
  const { examId } = req.params;

  const exam = await Exam.findById(examId)
    .populate('hallIds', 'name building floor capacity rows columns seatPrefix')
    .populate('studentIds', 'fullName rollNumber program semester');

  if (!exam) {
    res.status(404);
    throw new Error('Exam not found');
  }

  const [allocations, attendance, logs] = await Promise.all([
    SeatAllocation.find({ examId })
      .populate('studentId', 'fullName rollNumber program semester')
      .populate('hallId', 'name capacity rows columns'),
    Attendance.find({ examId })
      .populate('studentId', 'fullName rollNumber program semester')
      .populate('hallId', 'name capacity')
      .populate('scannedBy', 'name role')
      .sort({ scannedAt: -1 }),
    ScanLog.find({ examId })
      .populate('studentId', 'fullName rollNumber')
      .populate('hallId', 'name')
      .populate('scannedBy', 'name role')
      .sort({ createdAt: -1 })
  ]);

  const attendanceMap = new Map(attendance.map((item) => [item.studentId._id.toString(), item]));
  const assigned = allocations.length;
  const present = attendance.length;
  const absent = Math.max(assigned - present, 0);
  const progress = assigned === 0 ? 0 : Number(((present / assigned) * 100).toFixed(2));

  const hallOccupancyMap = new Map<
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

  for (const hall of exam.hallIds as any[]) {
    hallOccupancyMap.set(hall._id.toString(), {
      hallId: hall._id.toString(),
      hallName: hall.name,
      capacity: hall.capacity,
      assigned: 0,
      present: 0,
      vacant: hall.capacity,
      occupancyPercent: 0
    });
  }

  for (const allocation of allocations as any[]) {
    const hallId = allocation.hallId._id.toString();
    const item = hallOccupancyMap.get(hallId);
    if (item) {
      item.assigned += 1;
      item.vacant = Math.max(item.capacity - item.assigned, 0);
      item.occupancyPercent = item.capacity === 0 ? 0 : Number(((item.present / item.capacity) * 100).toFixed(2));
    }
  }

  for (const mark of attendance as any[]) {
    const hallId = mark.hallId._id.toString();
    const item = hallOccupancyMap.get(hallId);
    if (item) {
      item.present += 1;
      item.occupancyPercent = item.capacity === 0 ? 0 : Number(((item.present / item.capacity) * 100).toFixed(2));
    }
  }

  const hallOccupancy = Array.from(hallOccupancyMap.values());

  const seatingCharts = hallOccupancy.map((hall) => ({
    hallId: hall.hallId,
    hallName: hall.hallName,
    seats: (allocations as any[])
      .filter((allocation) => allocation.hallId._id.toString() === hall.hallId)
      .sort((a, b) => a.row - b.row || a.column - b.column)
      .map((allocation) => {
        const mark = attendanceMap.get(allocation.studentId._id.toString());
        return {
          seatNumber: allocation.seatNumber,
          row: allocation.row,
          column: allocation.column,
          studentId: allocation.studentId._id,
          studentName: allocation.studentId.fullName,
          rollNumber: allocation.studentId.rollNumber,
          program: allocation.studentId.program,
          semester: allocation.studentId.semester,
          status: mark ? 'present' : 'absent',
          scanMethod: mark?.scanMethod || null,
          scannedAt: mark?.scannedAt || null
        };
      })
  }));

  const absentStudents = (allocations as any[])
    .filter((allocation) => !attendanceMap.has(allocation.studentId._id.toString()))
    .map((allocation) => ({
      studentId: allocation.studentId._id,
      fullName: allocation.studentId.fullName,
      rollNumber: allocation.studentId.rollNumber,
      program: allocation.studentId.program,
      semester: allocation.studentId.semester,
      hallName: allocation.hallId.name,
      seatNumber: allocation.seatNumber
    }));

  const attendanceByMethod = [
    { method: 'qr', count: attendance.filter((item) => item.scanMethod === 'qr').length },
    { method: 'manual', count: attendance.filter((item) => item.scanMethod === 'manual').length },
    {
      method: 'offline-sync',
      count: attendance.filter((item) => item.scanMethod === 'offline-sync').length
    }
  ];

  const warningLogs = logs
    .filter((log) => ['duplicate', 'invalid'].includes(log.result))
    .slice(0, 50)
    .map((log) => ({
      id: log._id,
      result: log.result,
      message: log.message,
      hallName: (log.hallId as any)?.name || '-',
      studentName: (log.studentId as any)?.fullName || '-',
      rollNumber: (log.studentId as any)?.rollNumber || '-',
      createdAt: log.createdAt,
      scannedBy: (log.scannedBy as any)?.name || '-'
    }));

  const report = {
    generatedAt: new Date().toISOString(),
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
      progress,
      duplicateScanCount: logs.filter((log) => log.result === 'duplicate').length,
      invalidScanCount: logs.filter((log) => log.result === 'invalid').length,
      manualAttendanceCount: attendance.filter((item) => item.scanMethod === 'manual').length,
      offlineSyncCount: attendance.filter((item) => item.scanMethod === 'offline-sync').length
    },
    hallOccupancy,
    attendanceByMethod,
    seatingCharts,
    absentStudents,
    warningLogs,
    attendanceRecords: attendance.slice(0, 200).map((item: any) => ({
      id: item._id,
      fullName: item.studentId.fullName,
      rollNumber: item.studentId.rollNumber,
      hallName: item.hallId.name,
      scanMethod: item.scanMethod,
      scannedAt: item.scannedAt,
      scannedBy: item.scannedBy?.name || '-'
    }))
  };

  if (req.query.format === 'csv') {
    const rows = [
      ['Student Name', 'Roll Number', 'Hall', 'Seat', 'Status', 'Scan Method', 'Scanned At'],
      ...(allocations as any[]).map((allocation) => {
        const mark = attendanceMap.get(allocation.studentId._id.toString());
        return [
          allocation.studentId.fullName,
          allocation.studentId.rollNumber,
          allocation.hallId.name,
          allocation.seatNumber,
          mark ? 'present' : 'absent',
          mark?.scanMethod || '-',
          mark?.scannedAt ? new Date(mark.scannedAt).toISOString() : '-'
        ];
      })
    ];

    const csv = rows
      .map((row) => row.map(csvEscape).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${exam.subjectCode.toLowerCase()}-${exam.examDate}-attendance-report.csv`
    );
    res.send(csv);
    return;
  }

  res.json({ success: true, data: report });
});