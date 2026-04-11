import { createStudent, updateStudent, deleteStudent } from '../../src/controllers/studentController.js';
import { Student } from '../../src/models/Student.js';
import { buildQrPayload } from '../../src/utils/qr.js';

jest.mock('express-async-handler', () => ({
  __esModule: true,
  default: (fn: any) => (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next)
}));

jest.mock('../../src/models/Student.js', () => ({
  Student: {
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn()
  }
}));

jest.mock('../../src/utils/qr.js', () => ({
  buildQrPayload: jest.fn()
}));

const mockedStudent = Student as jest.Mocked<typeof Student>;
const mockedBuildQrPayload = buildQrPayload as jest.MockedFunction<typeof buildQrPayload>;

const createRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('studentController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 400 when required student fields are invalid', async () => {
    const req: any = {
      body: {
        fullName: '   ',
        rollNumber: 'cse-01',
        email: 'student@example.com',
        program: 'BSc CSIT',
        semester: 0
      }
    };
    const res = createRes();
    const next = jest.fn();

    await createStudent(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Valid full name, roll number, email, program, and semester are required'
      })
    );
    expect(res.json).not.toHaveBeenCalled();
  });

  test('creates a student, normalizes fields, and regenerates QR with persisted student id', async () => {
    mockedStudent.findOne.mockResolvedValue(null as any);
    mockedBuildQrPayload
      .mockReturnValueOnce('pending-qr')
      .mockReturnValueOnce('final-qr');

    const studentDoc = {
      _id: 'student_1',
      rollNumber: 'CSE-01',
      qrCodeValue: 'pending-qr',
      save: jest.fn().mockResolvedValue(undefined)
    } as any;

    mockedStudent.create.mockResolvedValue(studentDoc);

    const req: any = {
      body: {
        fullName: '  Aayan  ',
        rollNumber: ' cse-01 ',
        email: ' AAYAN@EXAMPLE.COM ',
        program: ' BSc CSIT ',
        semester: '3'
      }
    };
    const res = createRes();
    const next = jest.fn();

    await createStudent(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockedStudent.findOne).toHaveBeenCalledWith({
      $or: [{ rollNumber: 'CSE-01' }, { email: 'aayan@example.com' }]
    });
    expect(mockedStudent.create).toHaveBeenCalledWith({
      fullName: 'Aayan',
      rollNumber: 'CSE-01',
      email: 'aayan@example.com',
      program: 'BSc CSIT',
      semester: 3,
      qrCodeValue: 'pending-qr'
    });
    expect(mockedBuildQrPayload).toHaveBeenNthCalledWith(1, {
      type: 'student-attendance',
      studentId: 'pending-CSE-01',
      rollNumber: 'CSE-01'
    });
    expect(mockedBuildQrPayload).toHaveBeenNthCalledWith(2, {
      type: 'student-attendance',
      studentId: 'student_1',
      rollNumber: 'CSE-01'
    });
    expect(studentDoc.qrCodeValue).toBe('final-qr');
    expect(studentDoc.save).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: studentDoc
    });
  });

  test('returns 409 when updating to a duplicate email', async () => {
    mockedStudent.findById.mockResolvedValue({
      _id: 'student_1',
      fullName: 'Aayan',
      rollNumber: 'CSE-01',
      email: 'old@example.com',
      program: 'BSc CSIT',
      semester: 3,
      isActive: true,
      save: jest.fn()
    } as any);

    mockedStudent.findOne.mockResolvedValue({ _id: 'student_2' } as any);

    const req: any = {
      params: { id: 'student_1' },
      body: { email: 'duplicate@example.com' }
    };
    const res = createRes();
    const next = jest.fn();

    await updateStudent(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Another student already uses that email' })
    );
    expect(res.json).not.toHaveBeenCalled();
  });

  test('updates a student and deletes a student successfully', async () => {
    const studentDoc = {
      _id: 'student_1',
      fullName: 'Aayan',
      rollNumber: 'CSE-01',
      email: 'aayan@example.com',
      program: 'BSc CSIT',
      semester: 3,
      isActive: true,
      qrCodeValue: 'old-qr',
      save: jest.fn().mockResolvedValue(undefined),
      deleteOne: jest.fn().mockResolvedValue(undefined)
    } as any;

    mockedStudent.findById
      .mockResolvedValueOnce(studentDoc)
      .mockResolvedValueOnce(studentDoc);
    mockedStudent.findOne.mockResolvedValue(null as any);
    mockedBuildQrPayload.mockReturnValue('updated-qr');

    const updateReq: any = {
      params: { id: 'student_1' },
      body: {
        fullName: '  Aayan Razz ',
        rollNumber: ' cse-09 ',
        email: ' NEW@EXAMPLE.COM ',
        program: ' BCA ',
        semester: 5,
        isActive: false
      }
    };
    const updateRes = createRes();
    const updateNext = jest.fn();

    await updateStudent(updateReq, updateRes, updateNext);

    expect(updateNext).not.toHaveBeenCalled();
    expect(studentDoc.fullName).toBe('Aayan Razz');
    expect(studentDoc.rollNumber).toBe('CSE-09');
    expect(studentDoc.email).toBe('new@example.com');
    expect(studentDoc.program).toBe('BCA');
    expect(studentDoc.semester).toBe(5);
    expect(studentDoc.isActive).toBe(false);
    expect(studentDoc.qrCodeValue).toBe('updated-qr');
    expect(studentDoc.save).toHaveBeenCalledTimes(1);
    expect(updateRes.json).toHaveBeenCalledWith({
      success: true,
      data: studentDoc
    });

    const deleteReq: any = { params: { id: 'student_1' } };
    const deleteRes = createRes();
    const deleteNext = jest.fn();

    await deleteStudent(deleteReq, deleteRes, deleteNext);

    expect(deleteNext).not.toHaveBeenCalled();
    expect(studentDoc.deleteOne).toHaveBeenCalledTimes(1);
    expect(deleteRes.json).toHaveBeenCalledWith({
      success: true,
      message: 'Student deleted successfully'
    });
  });
});