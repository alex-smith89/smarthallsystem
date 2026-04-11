import { scanAttendance, markManualAttendance, syncOfflineAttendance } from '../../src/controllers/attendanceController.js';
import { Attendance } from '../../src/models/Attendance.js';
import { Exam } from '../../src/models/Exam.js';
import { ScanLog } from '../../src/models/ScanLog.js';
import { SeatAllocation } from '../../src/models/SeatAllocation.js';
import { Student } from '../../src/models/Student.js';
import { getIO } from '../../src/socket.js';
import { parseQrPayload } from '../../src/utils/qr.js';

jest.mock('express-async-handler', () => ({
  __esModule: true,
  default: (fn: any) => (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next)
}));

jest.mock('../../src/models/Attendance.js', () => ({
  Attendance: {
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn()
  }
}));

jest.mock('../../src/models/Exam.js', () => ({
  Exam: {
    findById: jest.fn()
  }
}));

jest.mock('../../src/models/ScanLog.js', () => ({
  ScanLog: {
    create: jest.fn()
  }
}));

jest.mock('../../src/models/SeatAllocation.js', () => ({
  SeatAllocation: {
    findOne: jest.fn()
  }
}));

jest.mock('../../src/models/Student.js', () => ({
  Student: {
    findById: jest.fn()
  }
}));

jest.mock('../../src/socket.js', () => ({
  getIO: jest.fn()
}));

jest.mock('../../src/utils/qr.js', () => ({
  parseQrPayload: jest.fn()
}));

const mockedAttendance = Attendance as jest.Mocked<typeof Attendance>;
const mockedExam = Exam as jest.Mocked<typeof Exam>;
const mockedScanLog = ScanLog as jest.Mocked<typeof ScanLog>;
const mockedSeatAllocation = SeatAllocation as jest.Mocked<typeof SeatAllocation>;
const mockedStudent = Student as jest.Mocked<typeof Student>;
const mockedGetIO = getIO as jest.MockedFunction<typeof getIO>;
const mockedParseQrPayload = parseQrPayload as jest.MockedFunction<typeof parseQrPayload>;

const io = { emit: jest.fn() };

const createRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createPopulatedAttendanceQuery = (value: any) => ({
  populate: jest.fn().mockReturnValue({
    populate: jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(value)
    })
  })
});

describe('attendanceController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetIO.mockReturnValue(io as any);
  });

  test('returns 400 and logs invalid scan when QR payload is invalid', async () => {
    mockedExam.findById.mockResolvedValue({ _id: 'exam_1' } as any);
    mockedParseQrPayload.mockReturnValue(null);

    const req: any = {
      user: { _id: 'user_1' },
      body: { examId: 'exam_1', qrCodeValue: 'bad-qr' }
    };
    const res = createRes();
    const next = jest.fn();

    await scanAttendance(req, res, next);

    expect(mockedScanLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        examId: 'exam_1',
        qrCodeValue: 'bad-qr',
        result: 'invalid',
        message: 'Invalid QR payload received',
        scannedBy: 'user_1'
      })
    );
    expect(io.emit).toHaveBeenCalledWith('dashboard:updated', {
      examId: 'exam_1',
      type: 'invalid-scan'
    });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Invalid QR code' })
    );
  });

  test('returns warning=true for duplicate attendance scan', async () => {
    mockedExam.findById.mockResolvedValue({ _id: 'exam_1' } as any);
    mockedParseQrPayload.mockReturnValue({
      type: 'student-attendance',
      studentId: 'student_1',
      rollNumber: 'CSE-01'
    } as any);
    mockedStudent.findById.mockResolvedValue({ _id: 'student_1' } as any);
    mockedSeatAllocation.findOne.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: 'alloc_1',
        hallId: 'hall_1'
      })
    } as any);
    mockedAttendance.findOne.mockResolvedValue({ _id: 'att_1' } as any);
    mockedAttendance.findById.mockReturnValue(
      createPopulatedAttendanceQuery({
        _id: 'att_1',
        studentId: { fullName: 'Aayan' }
      }) as any
    );

    const req: any = {
      user: { _id: 'user_1' },
      body: { examId: 'exam_1', qrCodeValue: 'valid-qr' }
    };
    const res = createRes();
    const next = jest.fn();

    await scanAttendance(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockedScanLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        examId: 'exam_1',
        studentId: 'student_1',
        hallId: 'hall_1',
        qrCodeValue: 'valid-qr',
        result: 'duplicate',
        message: 'Duplicate QR scan detected for this student',
        scannedBy: 'user_1'
      })
    );
    expect(io.emit).toHaveBeenCalledWith('dashboard:updated', {
      examId: 'exam_1',
      type: 'duplicate-scan',
      studentId: 'student_1'
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      warning: true,
      message: 'Duplicate scan detected. Attendance was already marked.',
      data: {
        _id: 'att_1',
        studentId: { fullName: 'Aayan' }
      }
    });
  });

  test('marks manual attendance successfully', async () => {
    mockedStudent.findById.mockResolvedValue({
      _id: 'student_1',
      qrCodeValue: 'stored-qr'
    } as any);

    mockedSeatAllocation.findOne.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: 'alloc_1',
        hallId: 'hall_1'
      })
    } as any);

    mockedAttendance.findOne.mockResolvedValue(null as any);
    mockedAttendance.create.mockResolvedValue({ _id: 'att_2' } as any);
    mockedAttendance.findById.mockReturnValue(
      createPopulatedAttendanceQuery({
        _id: 'att_2',
        scanMethod: 'manual'
      }) as any
    );

    const req: any = {
      user: { _id: 'user_1' },
      body: {
        examId: 'exam_1',
        studentId: 'student_1',
        notes: 'Checked with ID card'
      }
    };
    const res = createRes();
    const next = jest.fn();

    await markManualAttendance(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockedAttendance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        examId: 'exam_1',
        studentId: 'student_1',
        hallId: 'hall_1',
        seatAllocationId: 'alloc_1',
        qrCodeValue: 'stored-qr',
        scanMethod: 'manual',
        scannedBy: 'user_1',
        notes: 'Checked with ID card',
        status: 'present'
      })
    );
    expect(mockedScanLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        examId: 'exam_1',
        studentId: 'student_1',
        hallId: 'hall_1',
        qrCodeValue: 'stored-qr',
        result: 'manual',
        message: 'Attendance marked manually',
        scannedBy: 'user_1'
      })
    );
    expect(io.emit).toHaveBeenCalledWith('dashboard:updated', {
      examId: 'exam_1',
      type: 'attendance-marked',
      studentId: 'student_1'
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      warning: false,
      message: 'Attendance marked successfully',
      data: {
        _id: 'att_2',
        scanMethod: 'manual'
      }
    });
  });

  test('syncs offline attendance and aggregates successes and failures', async () => {
    mockedParseQrPayload
      .mockReturnValueOnce({
        type: 'student-attendance',
        studentId: 'student_1',
        rollNumber: 'CSE-01'
      } as any)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({
        type: 'student-attendance',
        studentId: 'student_2',
        rollNumber: 'CSE-02'
      } as any);

    mockedSeatAllocation.findOne
      .mockReturnValueOnce({
        populate: jest.fn().mockResolvedValue({
          _id: 'alloc_1',
          hallId: 'hall_1'
        })
      } as any)
      .mockReturnValueOnce({
        populate: jest.fn().mockResolvedValue(null)
      } as any);

    mockedAttendance.findOne.mockResolvedValue(null as any);
    mockedAttendance.create.mockResolvedValue({ _id: 'att_sync' } as any);

    const req: any = {
      user: { _id: 'user_1' },
      body: {
        examId: 'exam_1',
        qrCodeValues: ['qr-1', 'bad-qr', 'qr-2']
      }
    };
    const res = createRes();
    const next = jest.fn();

    await syncOfflineAttendance(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      count: 3,
      data: [
        {
          qrCodeValue: 'qr-1',
          success: true,
          message: 'Attendance marked successfully'
        },
        {
          qrCodeValue: 'bad-qr',
          success: false,
          message: 'Invalid QR payload'
        },
        {
          qrCodeValue: 'qr-2',
          success: false,
          message: 'Student is not allocated to this exam'
        }
      ]
    });
  });
});