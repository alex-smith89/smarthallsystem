import asyncHandler from 'express-async-handler';
import type { Request, Response } from 'express';
import { Exam } from '../models/Exam.js';
import { Hall } from '../models/Hall.js';
import { SeatAllocation } from '../models/SeatAllocation.js';
import { Student } from '../models/Student.js';
import { generateSeatAllocations, type SeatPlanItem } from '../utils/seatAllocator.js';
import { getIO } from '../socket.js';

export const generateAllocations = asyncHandler(async (req: Request, res: Response) => {
  const { examId } = req.body as { examId?: string };

  if (!examId) {
    res.status(400);
    throw new Error('examId is required');
  }

  const exam = await Exam.findById(examId);

  if (!exam) {
    res.status(404);
    throw new Error('Exam not found');
  }

  const students = await Student.find({
    _id: { $in: exam.studentIds },
    isActive: true
  }).select('rollNumber qrCodeValue');

  const halls = await Hall.find({
    _id: { $in: exam.hallIds }
  }).select('name capacity rows columns seatPrefix');

  const generated = generateSeatAllocations(
    students.map((student) => ({
      _id: student._id.toString(),
      rollNumber: student.rollNumber
    })),
    halls.map((hall) => ({
      _id: hall._id.toString(),
      name: hall.name,
      capacity: hall.capacity,
      rows: hall.rows,
      columns: hall.columns,
      seatPrefix: hall.seatPrefix ?? undefined
    }))
  );

  await SeatAllocation.deleteMany({ examId: exam._id });

  const studentMap = new Map(students.map((student) => [student._id.toString(), student]));

  const documents = generated.map((item: SeatPlanItem) => ({
    examId: exam._id,
    studentId: item.studentId,
    hallId: item.hallId,
    seatNumber: item.seatNumber,
    row: item.row,
    column: item.column,
    qrCodeValue: studentMap.get(item.studentId)?.qrCodeValue ?? ''
  }));

  await SeatAllocation.insertMany(documents);

  getIO().emit('dashboard:updated', {
    examId,
    type: 'allocations-regenerated'
  });

  const allocations = await SeatAllocation.find({ examId: exam._id })
    .populate('studentId', 'fullName rollNumber program semester')
    .populate('hallId', 'name building floor capacity rows columns')
    .sort({ hallId: 1, row: 1, column: 1 });

  res.json({
    success: true,
    count: allocations.length,
    data: allocations
  });
});

export const getAllocationsByExam = asyncHandler(async (req: Request, res: Response) => {
  const { examId } = req.params;

  const allocations = await SeatAllocation.find({ examId })
    .populate('studentId', 'fullName rollNumber program semester')
    .populate('hallId', 'name building floor capacity rows columns')
    .sort({ hallId: 1, row: 1, column: 1 });

  res.json({
    success: true,
    count: allocations.length,
    data: allocations
  });
});