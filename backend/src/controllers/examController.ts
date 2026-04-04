import asyncHandler from 'express-async-handler';
import type { Request, Response } from 'express';
import { Exam } from '../models/Exam.js';
import { Hall } from '../models/Hall.js';
import { Student } from '../models/Student.js';

function uniqueIds(values?: string[]): string[] {
  return Array.from(new Set((values || []).filter(Boolean)));
}

async function validateExamRelations(hallIds: string[], studentIds: string[], res: Response) {
  if (!hallIds.length) {
    res.status(400);
    throw new Error('At least one hall must be selected');
  }

  if (!studentIds.length) {
    res.status(400);
    throw new Error('At least one student must be selected');
  }

  const [hallCount, studentCount, totalCapacity] = await Promise.all([
    Hall.countDocuments({ _id: { $in: hallIds } }),
    Student.countDocuments({ _id: { $in: studentIds }, isActive: true }),
    Hall.aggregate([
      { $match: { _id: { $in: hallIds.map((id) => id as any) } } },
      { $group: { _id: null, total: { $sum: '$capacity' } } }
    ])
  ]);

  if (hallCount !== hallIds.length) {
    res.status(400);
    throw new Error('One or more selected halls no longer exist');
  }

  if (studentCount !== studentIds.length) {
    res.status(400);
    throw new Error('One or more selected students no longer exist or are inactive');
  }

  const capacity = Number(totalCapacity[0]?.total || 0);
  if (capacity < studentIds.length) {
    res.status(400);
    throw new Error('Selected halls do not have enough capacity for all chosen students');
  }
}

async function populateExam(examId: string) {
  return Exam.findById(examId)
    .populate('hallIds', 'name building floor capacity rows columns seatPrefix')
    .populate('studentIds', 'fullName rollNumber program semester email isActive qrCodeValue')
    .populate('createdBy', 'name email role');
}

export const getExams = asyncHandler(async (_req: Request, res: Response) => {
  const exams = await Exam.find()
    .populate('hallIds', 'name building floor capacity rows columns seatPrefix')
    .populate('studentIds', 'fullName rollNumber program semester email isActive qrCodeValue')
    .populate('createdBy', 'name email role')
    .sort({ examDate: 1, startTime: 1 });

  res.json({ success: true, count: exams.length, data: exams });
});

export const createExam = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401);
    throw new Error('Not authorized');
  }

  const { title, subjectCode, examDate, startTime, endTime } = req.body as {
    title?: string;
    subjectCode?: string;
    examDate?: string;
    startTime?: string;
    endTime?: string;
  };

  const hallIds = uniqueIds(req.body.hallIds as string[]);
  const studentIds = uniqueIds(req.body.studentIds as string[]);

  if (!title?.trim() || !subjectCode?.trim() || !examDate || !startTime || !endTime) {
    res.status(400);
    throw new Error('Title, subject code, exam date, start time, and end time are required');
  }

  await validateExamRelations(hallIds, studentIds, res);

  const exam = await Exam.create({
    title: title.trim(),
    subjectCode: subjectCode.trim(),
    examDate,
    startTime,
    endTime,
    hallIds,
    studentIds,
    createdBy: req.user._id
  });

  const populatedExam = await populateExam(exam._id.toString());

  res.status(201).json({ success: true, data: populatedExam });
});

export const updateExam = asyncHandler(async (req: Request, res: Response) => {
  const exam = await Exam.findById(req.params.id);

  if (!exam) {
    res.status(404);
    throw new Error('Exam not found');
  }

  const nextHallIds = uniqueIds((req.body.hallIds as string[]) || exam.hallIds.map((id) => id.toString()));
  const nextStudentIds = uniqueIds((req.body.studentIds as string[]) || exam.studentIds.map((id) => id.toString()));

  await validateExamRelations(nextHallIds, nextStudentIds, res);

  exam.title = req.body.title?.trim() ?? exam.title;
  exam.subjectCode = req.body.subjectCode?.trim() ?? exam.subjectCode;
  exam.examDate = req.body.examDate ?? exam.examDate;
  exam.startTime = req.body.startTime ?? exam.startTime;
  exam.endTime = req.body.endTime ?? exam.endTime;
  exam.status = req.body.status ?? exam.status;
  exam.hallIds = nextHallIds as any;
  exam.studentIds = nextStudentIds as any;

  await exam.save();

  const populatedExam = await populateExam(exam._id.toString());

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