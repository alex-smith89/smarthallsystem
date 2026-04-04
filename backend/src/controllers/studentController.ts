import asyncHandler from 'express-async-handler';
import type { Request, Response } from 'express';
import { Student } from '../models/Student.js';
import { buildQrPayload } from '../utils/qr.js';

export const getStudents = asyncHandler(async (_req: Request, res: Response) => {
  const students = await Student.find().sort({ rollNumber: 1 });
  res.json({ success: true, count: students.length, data: students });
});

export const createStudent = asyncHandler(async (req: Request, res: Response) => {
  const { fullName, rollNumber, email, program, semester } = req.body as {
    fullName?: string;
    rollNumber?: string;
    email?: string;
    program?: string;
    semester?: number;
  };

  if (!fullName || !rollNumber || !email || !program || !semester) {
    res.status(400);
    throw new Error('All student fields are required');
  }

  const qrCodeValue = buildQrPayload({
    type: 'student-attendance',
    studentId: `pending-${rollNumber}`,
    rollNumber
  });

  const student = await Student.create({
    fullName,
    rollNumber,
    email,
    program,
    semester,
    qrCodeValue
  });

  student.qrCodeValue = buildQrPayload({
    type: 'student-attendance',
    studentId: student._id.toString(),
    rollNumber: student.rollNumber
  });
  await student.save();

  res.status(201).json({ success: true, data: student });
});

export const updateStudent = asyncHandler(async (req: Request, res: Response) => {
  const student = await Student.findById(req.params.id);

  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }

  const { fullName, rollNumber, email, program, semester, isActive } = req.body;
  student.fullName = fullName ?? student.fullName;
  student.rollNumber = rollNumber ?? student.rollNumber;
  student.email = email ?? student.email;
  student.program = program ?? student.program;
  student.semester = semester ?? student.semester;
  student.isActive = isActive ?? student.isActive;
  student.qrCodeValue = buildQrPayload({
    type: 'student-attendance',
    studentId: student._id.toString(),
    rollNumber: student.rollNumber
  });

  await student.save();
  res.json({ success: true, data: student });
});

export const deleteStudent = asyncHandler(async (req: Request, res: Response) => {
  const student = await Student.findById(req.params.id);

  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }

  await student.deleteOne();
  res.json({ success: true, message: 'Student deleted successfully' });
});