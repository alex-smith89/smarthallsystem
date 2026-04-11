import { getDashboardSummary, getExamDashboard } from '../../src/controllers/dashboardController.js';
import { Attendance } from '../../src/models/Attendance.js';
import { Exam } from '../../src/models/Exam.js';
import { ScanLog } from '../../src/models/ScanLog.js';
import { SeatAllocation } from '../../src/models/SeatAllocation.js';
import { Student } from '../../src/models/Student.js';
import { Hall } from '../../src/models/Hall.js';
import {
  getHistoricalAttendanceTrend,
  getUpcomingHallForecast
} from '../../src/services/hallOccupancyForecast.service.js';

jest.mock('express-async-handler', () => ({
  __esModule: true,
  default: (fn: any) => (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next)
}));

jest.mock('../../src/models/Attendance.js', () => ({
  Attendance: {
    countDocuments: jest.fn(),
    find: jest.fn()
  }
}));

jest.mock('../../src/models/Exam.js', () => ({
  Exam: {
    countDocuments: jest.fn(),
    find: jest.fn(),
    findById: jest.fn()
  }
}));

jest.mock('../../src/models/ScanLog.js', () => ({
  ScanLog: {
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    find: jest.fn()
  }
}));

jest.mock('../../src/models/SeatAllocation.js', () => ({
  SeatAllocation: {
    countDocuments: jest.fn(),
    find: jest.fn()
  }
}));

jest.mock('../../src/models/Student.js', () => ({
  Student: {
    countDocuments: jest.fn()
  }
}));

jest.mock('../../src/models/Hall.js', () => ({
  Hall: {
    countDocuments: jest.fn()
  }
}));

jest.mock('../../src/services/hallOccupancyForecast.service.js', () => ({
  getHistoricalAttendanceTrend: jest.fn(),
  getUpcomingHallForecast: jest.fn()
}));

const mockedAttendance = Attendance as jest.Mocked<typeof Attendance>;
const mockedExam = Exam as jest.Mocked<typeof Exam>;
const mockedScanLog = ScanLog as jest.Mocked<typeof ScanLog>;
const mockedSeatAllocation = SeatAllocation as jest.Mocked<typeof SeatAllocation>;
const mockedStudent = Student as jest.Mocked<typeof Student>;
const mockedHall = Hall as jest.Mocked<typeof Hall>;
const mockedGetHistoricalAttendanceTrend =
  getHistoricalAttendanceTrend as jest.MockedFunction<typeof getHistoricalAttendanceTrend>;
const mockedGetUpcomingHallForecast =
  getUpcomingHallForecast as jest.MockedFunction<typeof getUpcomingHallForecast>;

const createRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createExamDashboardQuery = (value: any) => ({
  populate: jest.fn().mockReturnValue({
    populate: jest.fn().mockResolvedValue(value)
  })
});

describe('dashboardController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('builds dashboard summary cards and hall occupancy data', async () => {
    const todayExams = [
      { _id: 'exam_1', title: 'Midterm', subjectCode: 'CS101' },
      { _id: 'exam_2', title: 'Final', subjectCode: 'CS102' }
    ];

    mockedStudent.countDocuments
      .mockResolvedValueOnce(100 as any)
      .mockResolvedValueOnce(90 as any);

    mockedHall.countDocuments.mockResolvedValue(6 as any);
    mockedExam.countDocuments.mockResolvedValue(12 as any);

    mockedExam.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(todayExams)
        })
      })
    } as any);

    mockedScanLog.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue([{ _id: 'log_1' }])
        })
      })
    } as any);

    mockedScanLog.aggregate.mockResolvedValue([
      { _id: 'valid', count: 50 },
      { _id: 'invalid', count: 3 },
      { _id: 'duplicate', count: 2 },
      { _id: 'manual', count: 5 }
    ] as any);

    mockedSeatAllocation.countDocuments
      .mockResolvedValueOnce(80 as any)
      .mockResolvedValueOnce(40 as any)
      .mockResolvedValueOnce(35 as any);

    mockedAttendance.countDocuments
      .mockResolvedValueOnce(60 as any)
      .mockResolvedValueOnce(25 as any)
      .mockResolvedValueOnce(22 as any);

    mockedGetHistoricalAttendanceTrend.mockResolvedValue([{ date: '2026-04-01', rate: 80 }] as any);
    mockedGetUpcomingHallForecast.mockResolvedValue([{ hallName: 'Hall A', forecast: 42 }] as any);

    mockedScanLog.countDocuments.mockResolvedValue(0 as any);

    const req: any = {};
    const res = createRes();
    const next = jest.fn();

    await getDashboardSummary(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        cards: {
          totalStudents: 100,
          activeStudents: 90,
          totalHalls: 6,
          totalExams: 12,
          todayExams: 2,
          todaySeatAllocations: 80,
          todayPresent: 60,
          scansToday: 120,
          attendanceRate: 75
        },
        scans: {
          valid: 50,
          invalid: 3,
          duplicate: 2,
          manual: 5
        },
        todayExams,
        hallOccupancy: [
          {
            examId: 'exam_1',
            title: 'Midterm',
            subjectCode: 'CS101',
            allocated: 40,
            present: 25
          },
          {
            examId: 'exam_2',
            title: 'Final',
            subjectCode: 'CS102',
            allocated: 35,
            present: 22
          }
        ],
        recentLogs: [{ _id: 'log_1' }],
        trend: [{ date: '2026-04-01', rate: 80 }],
        hallForecast: [{ hallName: 'Hall A', forecast: 42 }]
      }
    });
  });

  test('returns 404 when exam dashboard target exam is missing', async () => {
    mockedExam.findById.mockReturnValue(createExamDashboardQuery(null) as any);

    const req: any = { params: { examId: 'missing_exam' } };
    const res = createRes();
    const next = jest.fn();

    await getExamDashboard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Exam not found' })
    );
  });

  test('builds exam dashboard summary grouped by hall', async () => {
    mockedExam.findById.mockReturnValue(
      createExamDashboardQuery({
        _id: 'exam_1',
        title: 'Midterm',
        subjectCode: 'CS101'
      }) as any
    );

    mockedSeatAllocation.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue([
          { hallId: { _id: 'hall_1', name: 'Hall A' } },
          { hallId: { _id: 'hall_1', name: 'Hall A' } },
          { hallId: { _id: 'hall_2', name: 'Hall B' } }
        ])
      })
    } as any);

    mockedAttendance.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue([
              { hallId: { _id: 'hall_1', name: 'Hall A' } },
              { hallId: { _id: 'hall_2', name: 'Hall B' } }
            ])
          })
        })
      })
    } as any);

    mockedScanLog.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([{ _id: 'log_1' }])
        })
      })
    } as any);

    const req: any = { params: { examId: 'exam_1' } };
    const res = createRes();
    const next = jest.fn();

    await getExamDashboard(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        exam: expect.objectContaining({
          _id: 'exam_1',
          title: 'Midterm',
          subjectCode: 'CS101'
        }),
        summary: {
          allocatedCount: 3,
          presentCount: 2,
          absentCount: 1,
          attendanceRate: 66.7
        },
        byHall: [
          { hallName: 'Hall A', allocated: 2, present: 1 },
          { hallName: 'Hall B', allocated: 1, present: 1 }
        ],
        allocations: expect.any(Array),
        attendance: expect.any(Array),
        logs: expect.any(Array)
      }
    });
  });
});