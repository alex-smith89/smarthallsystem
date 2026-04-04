import asyncHandler from 'express-async-handler';
import type { Request, Response } from 'express';
import { Exam } from '../models/Exam.js';

export const getExams = asyncHandler(async (_req: Request, res: Response) => {
  const exams = await Exam.find()
    .populate('hallIds', 'name building floor capacity')
    .populate('studentIds', 'fullName rollNumber program semester')
    .populate('createdBy', 'name email role')
    .sort({ examDate: 1, startTime: 1 });

  res.json({ success: true, count: exams.length, data: exams });
});

export const createExam = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401);
    throw new Error('Not authorized');
  }

  const { title, subjectCode, examDate, startTime, endTime, hallIds, studentIds } = req.body as {
    title?: string;
    subjectCode?: string;
    examDate?: string;
    startTime?: string;
    endTime?: string;
    hallIds?: string[];
    studentIds?: string[];
  };

  if (!title || !subjectCode || !examDate || !startTime || !endTime) {
    res.status(400);
    throw new Error('All exam fields are required');
  }

  if (!hallIds?.length) {
    res.status(400);
    throw new Error('At least one hall must be selected');
  }

  if (!studentIds?.length) {
    res.status(400);
    throw new Error('At least one student must be selected');
  }

  const exam = await Exam.create({
    title,
    subjectCode,
    examDate,
    startTime,
    endTime,
    hallIds,
    studentIds,
    createdBy: req.user._id
  });

  const populatedExam = await Exam.findById(exam._id)
    .populate('hallIds', 'name building floor capacity')
    .populate('studentIds', 'fullName rollNumber program semester')
    .populate('createdBy', 'name email role');

  res.status(201).json({ success: true, data: populatedExam });
});

export const updateExam = asyncHandler(async (req: Request, res: Response) => {
  const exam = await Exam.findById(req.params.id);

  if (!exam) {
    res.status(404);
    throw new Error('Exam not found');
  }

  Object.assign(exam, req.body);
  await exam.save();

  const populatedExam = await Exam.findById(exam._id)
    .populate('hallIds', 'name building floor capacity')
    .populate('studentIds', 'fullName rollNumber program semester')
    .populate('createdBy', 'name email role');

  res.json({ success: true, data: populatedExam });
});

export const deleteExam = asyncHandler(async (req: Request, res: Response) => {
  const exam = await Exam.findById(req.params.id);

  if (!exam) {
    res.status(404);
    throw new Error('Exam not found');
  }

  await exam.deleteOne();
  res.json({ success: true, message: 'Exam deleted successfully' });
});