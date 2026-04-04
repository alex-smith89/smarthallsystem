import asyncHandler from 'express-async-handler';
import type { Request, Response } from 'express';
import { Student } from '../models/Student.js';
import { buildQrPayload } from '../utils/qr.js';

function normalizeStudentPayload(payload: {
  fullName?: string;
  rollNumber?: string;
  email?: string;
  program?: string;
  semester?: number | string;
}) {
  return {
    fullName: payload.fullName?.trim(),
    rollNumber: payload.rollNumber?.trim().toUpperCase(),
    email: payload.email?.trim().toLowerCase(),
    program: payload.program?.trim(),
    semester: Number(payload.semester)
  };
}

export const getStudents = asyncHandler(async (_req: Request, res: Response) => {
  const students = await Student.find().sort({ rollNumber: 1 });
  res.json({ success: true, count: students.length, data: students });
});

export const createStudent = asyncHandler(async (req: Request, res: Response) => {
  const normalized = normalizeStudentPayload(req.body as {
    fullName?: string;
    rollNumber?: string;
    email?: string;
    program?: string;
    semester?: number;
  });

  if (
    !normalized.fullName ||
    !normalized.rollNumber ||
    !normalized.email ||
    !normalized.program ||
    !Number.isInteger(normalized.semester) ||
    normalized.semester < 1
  ) {
    res.status(400);
    throw new Error('Valid full name, roll number, email, program, and semester are required');
  }

  const duplicate = await Student.findOne({
    $or: [{ rollNumber: normalized.rollNumber }, { email: normalized.email }]
  });

  if (duplicate) {
    res.status(409);
    throw new Error('A student with the same roll number or email already exists');
  }

  const qrCodeValue = buildQrPayload({
    type: 'student-attendance',
    studentId: `pending-${normalized.rollNumber}`,
    rollNumber: normalized.rollNumber
  });

  const student = await Student.create({
    ...normalized,
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

  const normalized = normalizeStudentPayload(req.body);

  if (normalized.rollNumber && normalized.rollNumber !== student.rollNumber) {
    const existingRoll = await Student.findOne({
      rollNumber: normalized.rollNumber,
      _id: { $ne: student._id }
    });

    if (existingRoll) {
      res.status(409);
      throw new Error('Another student already uses that roll number');
    }
  }

  if (normalized.email && normalized.email !== student.email) {
    const existingEmail = await Student.findOne({
      email: normalized.email,
      _id: { $ne: student._id }
    });

    if (existingEmail) {
      res.status(409);
      throw new Error('Another student already uses that email');
    }
  }

  student.fullName = normalized.fullName ?? student.fullName;
  student.rollNumber = normalized.rollNumber ?? student.rollNumber;
  student.email = normalized.email ?? student.email;
  student.program = normalized.program ?? student.program;
  student.semester =
    Number.isFinite(normalized.semester) && normalized.semester > 0
      ? normalized.semester
      : student.semester;
  student.isActive = typeof req.body.isActive === 'boolean' ? req.body.isActive : student.isActive;
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