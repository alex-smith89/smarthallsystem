import { getExamReport } from '../../src/controllers/reportsController.js';
import { Attendance } from '../../src/models/Attendance.js';
import { Exam } from '../../src/models/Exam.js';
import { ScanLog } from '../../src/models/ScanLog.js';
import { SeatAllocation } from '../../src/models/SeatAllocation.js';

jest.mock('express-async-handler', () => ({
  __esModule: true,
  default: (fn: any) => (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next)
}));

jest.mock('../../src/models/Attendance.js', () => ({
  Attendance: {
    find: jest.fn()
  }
}));

jest.mock('../../src/models/Exam.js', () => ({
  Exam: {
    findById: jest.fn()
  }
}));

jest.mock('../../src/models/ScanLog.js', () => ({
  ScanLog: {
    find: jest.fn()
  }
}));

jest.mock('../../src/models/SeatAllocation.js', () => ({
  SeatAllocation: {
    find: jest.fn()
  }
}));

const mockedAttendance = Attendance as jest.Mocked<typeof Attendance>;
const mockedExam = Exam as jest.Mocked<typeof Exam>;
const mockedScanLog = ScanLog as jest.Mocked<typeof ScanLog>;
const mockedSeatAllocation = SeatAllocation as jest.Mocked<typeof SeatAllocation>;

const createRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
};

const createExamQuery = (value: any) => ({
  populate: jest.fn().mockReturnValue({
    populate: jest.fn().mockResolvedValue(value)
  })
});

describe('reportsController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 404 when exam is not found', async () => {
    mockedExam.findById.mockReturnValue(createExamQuery(null) as any);

    const req: any = { params: { examId: 'missing_exam' }, query: {} };
    const res = createRes();
    const next = jest.fn();

    await getExamReport(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Exam not found' })
    );
  });

  test('builds JSON report summary successfully', async () => {
    const exam = {
      _id: 'exam_1',
      title: 'Midterm',
      subjectCode: 'CS101',
      examDate: '2026-04-10',
      startTime: '09:00',
      endTime: '11:00',
      status: 'scheduled',
      hallIds: [
        { _id: 'hall_1', name: 'Hall A', capacity: 2 },
        { _id: 'hall_2', name: 'Hall B', capacity: 2 }
      ],
      studentIds: []
    };

    const allocations = [
      {
        studentId: {
          _id: 'student_1',
          fullName: 'Aayan',
          rollNumber: 'R1',
          program: 'BSc',
          semester: 3
        },
        hallId: { _id: 'hall_1', name: 'Hall A' },
        seatNumber: 'A-1',
        row: 1,
        column: 1
      },
      {
        studentId: {
          _id: 'student_2',
          fullName: 'Bina',
          rollNumber: 'R2',
          program: 'BSc',
          semester: 3
        },
        hallId: { _id: 'hall_1', name: 'Hall A' },
        seatNumber: 'A-2',
        row: 1,
        column: 2
      }
    ];

    const attendance = [
      {
        _id: 'att_1',
        studentId: {
          _id: 'student_1',
          fullName: 'Aayan',
          rollNumber: 'R1',
          program: 'BSc',
          semester: 3
        },
        hallId: { _id: 'hall_1', name: 'Hall A' },
        scanMethod: 'manual',
        scannedAt: '2026-04-10T09:05:00.000Z',
        scannedBy: { name: 'Invigilator 1' }
      }
    ];

    const logs = [
      {
        _id: 'log_1',
        result: 'duplicate',
        message: 'Duplicate QR scan detected for this student',
        hallId: { name: 'Hall A' },
        studentId: { fullName: 'Aayan', rollNumber: 'R1' },
        scannedBy: { name: 'Invigilator 1' },
        createdAt: '2026-04-10T09:06:00.000Z'
      }
    ];

    mockedExam.findById.mockReturnValue(createExamQuery(exam) as any);

    mockedSeatAllocation.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(allocations)
      })
    } as any);

    mockedAttendance.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue(attendance)
          })
        })
      })
    } as any);

    mockedScanLog.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue(logs)
          })
        })
      })
    } as any);

    const req: any = { params: { examId: 'exam_1' }, query: {} };
    const res = createRes();
    const next = jest.fn();

    await getExamReport(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          exam: expect.objectContaining({
            _id: 'exam_1',
            title: 'Midterm',
            subjectCode: 'CS101'
          }),
          summary: expect.objectContaining({
            assigned: 2,
            present: 1,
            absent: 1,
            progress: 50,
            duplicateScanCount: 1,
            invalidScanCount: 0,
            manualAttendanceCount: 1,
            offlineSyncCount: 0
          }),
          hallOccupancy: [
            expect.objectContaining({
              hallId: 'hall_1',
              hallName: 'Hall A',
              capacity: 2,
              assigned: 2,
              present: 1,
              vacant: 0,
              occupancyPercent: 50
            }),
            expect.objectContaining({
              hallId: 'hall_2',
              hallName: 'Hall B',
              capacity: 2,
              assigned: 0,
              present: 0,
              vacant: 2,
              occupancyPercent: 0
            })
          ],
          absentStudents: [
            expect.objectContaining({
              fullName: 'Bina',
              rollNumber: 'R2',
              hallName: 'Hall A',
              seatNumber: 'A-2'
            })
          ],
          warningLogs: [
            expect.objectContaining({
              result: 'duplicate',
              hallName: 'Hall A',
              studentName: 'Aayan'
            })
          ]
        })
      })
    );
  });

  test('exports CSV when format=csv', async () => {
    const exam = {
      _id: 'exam_1',
      title: 'Midterm',
      subjectCode: 'CS101',
      examDate: '2026-04-10',
      startTime: '09:00',
      endTime: '11:00',
      status: 'scheduled',
      hallIds: [{ _id: 'hall_1', name: 'Hall A', capacity: 1 }],
      studentIds: []
    };

    mockedExam.findById.mockReturnValue(createExamQuery(exam) as any);

    mockedSeatAllocation.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue([
          {
            studentId: {
              _id: 'student_1',
              fullName: 'Aayan, Razz',
              rollNumber: 'R1',
              program: 'BSc',
              semester: 3
            },
            hallId: { _id: 'hall_1', name: 'Hall A' },
            seatNumber: 'A-1',
            row: 1,
            column: 1
          }
        ])
      })
    } as any);

    mockedAttendance.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue([])
          })
        })
      })
    } as any);

    mockedScanLog.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue([])
          })
        })
      })
    } as any);

    const req: any = { params: { examId: 'exam_1' }, query: { format: 'csv' } };
    const res = createRes();
    const next = jest.fn();

    await getExamReport(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename=cs101-2026-04-10-attendance-report.csv'
    );
    expect(res.send).toHaveBeenCalledWith(
      expect.stringContaining('"Aayan, Razz",R1,Hall A,A-1,absent,-,-')
    );
  });
});