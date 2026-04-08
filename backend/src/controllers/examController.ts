import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import type { Request, Response } from 'express';
import { Exam, type ExamDocument } from '../models/Exam.js';
import { Hall } from '../models/Hall.js';
import { Student } from '../models/Student.js';

function uniqueIds(values?: string[]): string[] {
  return Array.from(
    new Set(
      (values || [])
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function validateTimeWindow(startTime: string, endTime: string, res: Response): void {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  if (startMinutes === null || endMinutes === null) {
    res.status(400);
    throw new Error('Start time and end time must be valid HH:MM values');
  }

  if (endMinutes <= startMinutes) {
    res.status(400);
    throw new Error('End time must be later than start time');
  }
}

function rangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const startAMinutes = parseTimeToMinutes(startA);
  const endAMinutes = parseTimeToMinutes(endA);
  const startBMinutes = parseTimeToMinutes(startB);
  const endBMinutes = parseTimeToMinutes(endB);

  if (
    startAMinutes === null ||
    endAMinutes === null ||
    startBMinutes === null ||
    endBMinutes === null
  ) {
    return false;
  }

  return startAMinutes < endBMinutes && startBMinutes < endAMinutes;
}

async function validateExamRelationsAndConflicts(args: {
  hallIds: string[];
  studentIds: string[];
  examDate: string;
  startTime: string;
  endTime: string;
  res: Response;
  excludeExamId?: string;
}) {
  const { hallIds, studentIds, examDate, startTime, endTime, res, excludeExamId } = args;

  if (!hallIds.length) {
    res.status(400);
    throw new Error('At least one hall must be selected');
  }

  if (!studentIds.length) {
    res.status(400);
    throw new Error('At least one student must be selected');
  }

  validateTimeWindow(startTime, endTime, res);

  const hallObjectIds = hallIds.map((id) => new mongoose.Types.ObjectId(id));

  const [hallCount, studentCount, totalCapacity, sameDayRelatedExams] = await Promise.all([
    Hall.countDocuments({ _id: { $in: hallIds } }),
    Student.countDocuments({ _id: { $in: studentIds }, isActive: true }),
    Hall.aggregate([
      { $match: { _id: { $in: hallObjectIds } } },
      { $group: { _id: null, total: { $sum: '$capacity' } } }
    ]),
    Exam.find({
      examDate,
      ...(excludeExamId ? { _id: { $ne: excludeExamId } } : {}),
      $or: [{ hallIds: { $in: hallIds } }, { studentIds: { $in: studentIds } }]
    }).select('title subjectCode startTime endTime hallIds studentIds')
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

  const overlappingExams = sameDayRelatedExams.filter((exam) =>
    rangesOverlap(startTime, endTime, exam.startTime, exam.endTime)
  );

  if (!overlappingExams.length) {
    return;
  }

  const hallConflictExam = overlappingExams.find((exam) =>
    (exam.hallIds as mongoose.Types.ObjectId[]).some((id) => hallIds.includes(id.toString()))
  );

  if (hallConflictExam) {
    res.status(409);
    throw new Error(
      `One or more selected halls are already assigned to ${hallConflictExam.subjectCode} - ${hallConflictExam.title} during an overlapping time slot`
    );
  }

  const studentConflictExam = overlappingExams.find((exam) =>
    (exam.studentIds as mongoose.Types.ObjectId[]).some((id) => studentIds.includes(id.toString()))
  );

  if (studentConflictExam) {
    res.status(409);
    throw new Error(
      `One or more selected students are already assigned to ${studentConflictExam.subjectCode} - ${studentConflictExam.title} during an overlapping time slot`
    );
  }
}

export const getExams = asyncHandler(async (_req: Request, res: Response) => {
  const exams = await Exam.find()
    .populate('hallIds', 'name building capacity rows columns')
    .populate('studentIds', 'fullName rollNumber program semester')
    .sort({ examDate: 1, startTime: 1 });

  res.json({ success: true, data: exams });
});

export const getExamById = asyncHandler(async (req: Request, res: Response) => {
  const exam = await Exam.findById(req.params.id)
    .populate('hallIds', 'name building capacity rows columns')
    .populate('studentIds', 'fullName rollNumber program semester');

  if (!exam) {
    res.status(404);
    throw new Error('Exam not found');
  }

  res.json({ success: true, data: exam });
});

export const createExam = asyncHandler(async (req: Request, res: Response) => {
  const hallIds = uniqueIds(req.body.hallIds);
  const studentIds = uniqueIds(req.body.studentIds);

  const payload = {
    title: String(req.body.title || '').trim(),
    subjectCode: String(req.body.subjectCode || '').trim().toUpperCase(),
    examDate: String(req.body.examDate || '').trim(),
    startTime: String(req.body.startTime || '').trim(),
    endTime: String(req.body.endTime || '').trim(),
    durationMinutes: Number(req.body.durationMinutes),
    hallIds,
    studentIds,
    ...(req.user?._id ? { createdBy: req.user._id } : {})
  };

  if (
    !payload.title ||
    !payload.subjectCode ||
    !payload.examDate ||
    !payload.startTime ||
    !payload.endTime ||
    !payload.durationMinutes
  ) {
    res.status(400);
    throw new Error('Please provide all required exam fields');
  }

  await validateExamRelationsAndConflicts({
    hallIds: payload.hallIds,
    studentIds: payload.studentIds,
    examDate: payload.examDate,
    startTime: payload.startTime,
    endTime: payload.endTime,
    res
  });

  const exam = await Exam.create(payload);

  const populated = await Exam.findById(exam._id)
    .populate('hallIds', 'name building capacity rows columns')
    .populate('studentIds', 'fullName rollNumber program semester');

  res.status(201).json({ success: true, data: populated });
});

export const updateExam = asyncHandler(async (req: Request, res: Response) => {
  const exam = (await Exam.findById(req.params.id)) as ExamDocument | null;

  if (!exam) {
    res.status(404);
    throw new Error('Exam not found');
  }

  const hallIds = uniqueIds(
    req.body.hallIds ?? exam.hallIds.map((id) => id.toString())
  );

  const studentIds = uniqueIds(
    req.body.studentIds ?? exam.studentIds.map((id) => id.toString())
  );

  const nextValues = {
    title: String(req.body.title ?? exam.title).trim(),
    subjectCode: String(req.body.subjectCode ?? exam.subjectCode)
      .trim()
      .toUpperCase(),
    examDate: String(req.body.examDate ?? exam.examDate).trim(),
    startTime: String(req.body.startTime ?? exam.startTime).trim(),
    endTime: String(req.body.endTime ?? exam.endTime).trim(),
    durationMinutes: Number(req.body.durationMinutes ?? exam.durationMinutes),
    hallIds,
    studentIds
  };

  await validateExamRelationsAndConflicts({
    hallIds: nextValues.hallIds,
    studentIds: nextValues.studentIds,
    examDate: nextValues.examDate,
    startTime: nextValues.startTime,
    endTime: nextValues.endTime,
    res,
    excludeExamId: req.params.id
  });

  exam.title = nextValues.title;
  exam.subjectCode = nextValues.subjectCode;
  exam.examDate = nextValues.examDate;
  exam.startTime = nextValues.startTime;
  exam.endTime = nextValues.endTime;
  exam.durationMinutes = nextValues.durationMinutes;
  exam.hallIds = nextValues.hallIds as unknown as typeof exam.hallIds;
  exam.studentIds = nextValues.studentIds as unknown as typeof exam.studentIds;

  await exam.save();

  const populated = await Exam.findById(exam._id)
    .populate('hallIds', 'name building capacity rows columns')
    .populate('studentIds', 'fullName rollNumber program semester');

  res.json({ success: true, data: populated });
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