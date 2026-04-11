import mongoose from 'mongoose';
import { createExam, updateExam, deleteExam } from '../../src/controllers/examController.js';
import { Exam } from '../../src/models/Exam.js';
import { Hall } from '../../src/models/Hall.js';
import { Student } from '../../src/models/Student.js';

jest.mock('express-async-handler', () => ({
  __esModule: true,
  default: (fn: any) => (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next)
}));

jest.mock('../../src/models/Exam.js', () => ({
  Exam: {
    find: jest.fn(),
    findById: jest.fn(),
    create: jest.fn()
  }
}));

jest.mock('../../src/models/Hall.js', () => ({
  Hall: {
    countDocuments: jest.fn(),
    aggregate: jest.fn()
  }
}));

jest.mock('../../src/models/Student.js', () => ({
  Student: {
    countDocuments: jest.fn()
  }
}));

const mockedExam = Exam as jest.Mocked<typeof Exam>;
const mockedHall = Hall as jest.Mocked<typeof Hall>;
const mockedStudent = Student as jest.Mocked<typeof Student>;

const createRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createPopulatedExamQuery = (value: any) => ({
  populate: jest.fn().mockReturnValue({
    populate: jest.fn().mockResolvedValue(value)
  })
});

describe('examController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 400 when required exam fields are missing', async () => {
    const req: any = {
      body: {
        title: 'Midterm',
        subjectCode: '',
        examDate: '2026-04-10',
        startTime: '09:00',
        endTime: '11:00',
        durationMinutes: 120,
        hallIds: ['hall_1'],
        studentIds: ['student_1']
      }
    };
    const res = createRes();
    const next = jest.fn();

    await createExam(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Please provide all required exam fields'
      })
    );
    expect(res.json).not.toHaveBeenCalled();
  });

  test('returns 409 when halls conflict with an overlapping exam', async () => {
    const hallId = new mongoose.Types.ObjectId().toString();
    const studentId = new mongoose.Types.ObjectId().toString();

    mockedHall.countDocuments.mockResolvedValue(1 as any);
    mockedStudent.countDocuments.mockResolvedValue(1 as any);
    mockedHall.aggregate.mockResolvedValue([{ total: 50 }] as any);
    mockedExam.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([
        {
          title: 'Algorithms',
          subjectCode: 'CSC202',
          startTime: '09:30',
          endTime: '11:30',
          hallIds: [new mongoose.Types.ObjectId(hallId)],
          studentIds: [new mongoose.Types.ObjectId(studentId)]
        }
      ])
    } as any);

    const req: any = {
      body: {
        title: 'Midterm',
        subjectCode: 'cs101',
        examDate: '2026-04-10',
        startTime: '10:00',
        endTime: '12:00',
        durationMinutes: 120,
        hallIds: [hallId],
        studentIds: [studentId]
      },
      user: { _id: 'admin_1' }
    };
    const res = createRes();
    const next = jest.fn();

    await createExam(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(
          'One or more selected halls are already assigned to CSC202 - Algorithms'
        )
      })
    );
  });

  test('creates, updates, and deletes an exam successfully', async () => {
    const hallId = new mongoose.Types.ObjectId().toString();
    const studentId = new mongoose.Types.ObjectId().toString();

    mockedHall.countDocuments.mockResolvedValue(1 as any);
    mockedStudent.countDocuments.mockResolvedValue(1 as any);
    mockedHall.aggregate.mockResolvedValue([{ total: 60 }] as any);
    mockedExam.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([])
    } as any);

    mockedExam.create.mockResolvedValue({ _id: 'exam_1' } as any);

    const examDoc: any = {
      _id: 'exam_1',
      title: 'Midterm',
      subjectCode: 'CS101',
      examDate: '2026-04-10',
      startTime: '09:00',
      endTime: '11:00',
      durationMinutes: 120,
      hallIds: [hallId],
      studentIds: [studentId],
      save: jest.fn().mockResolvedValue(undefined),
      deleteOne: jest.fn().mockResolvedValue(undefined)
    };

    mockedExam.findById
      .mockReturnValueOnce(
        createPopulatedExamQuery({
          _id: 'exam_1',
          title: 'Midterm',
          subjectCode: 'CS101'
        }) as any
      )
      .mockResolvedValueOnce(examDoc)
      .mockReturnValueOnce(
        createPopulatedExamQuery({
          _id: 'exam_1',
          title: 'Updated Midterm',
          subjectCode: 'CSC101'
        }) as any
      )
      .mockResolvedValueOnce(examDoc);

    const createReq: any = {
      body: {
        title: ' Midterm ',
        subjectCode: ' cs101 ',
        examDate: '2026-04-10',
        startTime: '09:00',
        endTime: '11:00',
        durationMinutes: 120,
        hallIds: [hallId, hallId],
        studentIds: [studentId, studentId]
      },
      user: { _id: 'admin_1' }
    };
    const createExamRes = createRes();
    const createNext = jest.fn();

    await createExam(createReq, createExamRes, createNext);

    expect(createNext).not.toHaveBeenCalled();
    expect(mockedExam.create).toHaveBeenCalledWith({
      title: 'Midterm',
      subjectCode: 'CS101',
      examDate: '2026-04-10',
      startTime: '09:00',
      endTime: '11:00',
      durationMinutes: 120,
      hallIds: [hallId],
      studentIds: [studentId],
      createdBy: 'admin_1'
    });
    expect(createExamRes.status).toHaveBeenCalledWith(201);

    const updateReq: any = {
      params: { id: 'exam_1' },
      body: {
        title: ' Updated Midterm ',
        subjectCode: ' csc101 '
      }
    };
    const updateRes = createRes();
    const updateNext = jest.fn();

    await updateExam(updateReq, updateRes, updateNext);

    expect(updateNext).not.toHaveBeenCalled();
    expect(examDoc.title).toBe('Updated Midterm');
    expect(examDoc.subjectCode).toBe('CSC101');
    expect(examDoc.save).toHaveBeenCalledTimes(1);
    expect(updateRes.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        _id: 'exam_1',
        title: 'Updated Midterm',
        subjectCode: 'CSC101'
      })
    });

    const deleteReq: any = { params: { id: 'exam_1' } };
    const deleteRes = createRes();
    const deleteNext = jest.fn();

    await deleteExam(deleteReq, deleteRes, deleteNext);

    expect(deleteNext).not.toHaveBeenCalled();
    expect(examDoc.deleteOne).toHaveBeenCalledTimes(1);
    expect(deleteRes.json).toHaveBeenCalledWith({
      success: true,
      message: 'Exam deleted successfully'
    });
  });
});