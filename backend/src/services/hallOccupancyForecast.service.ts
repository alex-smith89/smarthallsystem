import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { Attendance } from '../models/Attendance.js';
import { Exam } from '../models/Exam.js';
import { Hall } from '../models/Hall.js';
import { SeatAllocation } from '../models/SeatAllocation.js';

type ForecastFeatureRow = {
  exam_id: string;
  hall_id: string;
  exam_subject_code: string;
  exam_day_of_week: string;
  exam_month: number;
  exam_start_hour: number;
  exam_duration_minutes: number;
  hall_name: string;
  hall_building: string;
  hall_floor: string;
  hall_capacity: number;
  allocated_count: number;
  dominant_program: string;
  avg_semester: number;
  avg_seat_row: number;
  avg_seat_column: number;
  hall_fill_ratio: number;
};

type ForecastPrediction = {
  attendance_rate: number;
};

type HistoricalSample = {
  examId: string;
  hallId: string;
  subjectCode: string;
  allocatedCount: number;
  presentCount: number;
  attendanceRate: number;
};

export type DashboardTrendPoint = {
  date: string;
  examCount: number;
  allocatedCount: number;
  presentCount: number;
  attendanceRate: number;
  capacityCount: number;
  occupancyRate: number;
};

export type DashboardForecastItem = {
  examId: string;
  examTitle: string;
  subjectCode: string;
  examDate: string;
  startTime: string;
  hallId: string;
  hallName: string;
  hallBuilding: string;
  hallFloor: string;
  hallCapacity: number;
  allocatedCount: number;
  predictedPresentCount: number;
  predictedAttendanceRate: number;
  predictedOccupancyRate: number;
  predictionBasis: 'ml' | 'fallback';
  confidenceLabel: 'high' | 'medium' | 'low';
};

function resolveMlFile(fileName: string): string {
  const candidates = [
    resolve(process.cwd(), '../ml', fileName),
    resolve(process.cwd(), 'ml', fileName)
  ];

  const existing = candidates.find((candidate) => existsSync(candidate));
  return existing || candidates[0];
}

const defaultModelPath = resolveMlFile('hall_occupancy_model.joblib');
const defaultPredictScriptPath = resolveMlFile('predict_hall_occupancy.py');

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function average(numbers: number[]): number {
  if (!numbers.length) return 0;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function getDayOfWeek(dateValue: string): string {
  const date = new Date(`${dateValue}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? 'Unknown'
    : date.toLocaleDateString('en-US', { weekday: 'long' });
}

function getMonthNumber(dateValue: string): number {
  const date = new Date(`${dateValue}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 0 : date.getMonth() + 1;
}

function getStartHour(timeValue: string): number {
  const [hourText] = String(timeValue || '').split(':');
  const hour = Number(hourText);
  return Number.isFinite(hour) ? hour : 0;
}

function getConfidenceLabel(
  sampleCount: number,
  basis: 'ml' | 'fallback'
): 'high' | 'medium' | 'low' {
  if (basis === 'ml') {
    if (sampleCount >= 5) return 'high';
    if (sampleCount >= 2) return 'medium';
    return 'low';
  }

  if (sampleCount >= 6) return 'medium';
  if (sampleCount >= 2) return 'low';
  return 'low';
}

async function buildHistoricalSamples(): Promise<HistoricalSample[]> {
  const exams = await Exam.find({}).select('_id subjectCode').lean();
  if (!exams.length) return [];

  const examIds = exams.map((exam) => exam._id);
  const examIdToSubject = new Map(
    exams.map((exam) => [String(exam._id), exam.subjectCode])
  );

  const [allocationCountsRaw, attendanceCountsRaw] = await Promise.all([
    SeatAllocation.aggregate([
      { $match: { examId: { $in: examIds } } },
      {
        $group: {
          _id: { examId: '$examId', hallId: '$hallId' },
          allocatedCount: { $sum: 1 }
        }
      }
    ]),
    Attendance.aggregate([
      { $match: { examId: { $in: examIds } } },
      {
        $group: {
          _id: { examId: '$examId', hallId: '$hallId' },
          presentCount: { $sum: 1 }
        }
      }
    ])
  ]);

  const attendanceMap = new Map(
    attendanceCountsRaw.map((item) => [
      `${String(item._id.examId)}:${String(item._id.hallId)}`,
      Number(item.presentCount || 0)
    ])
  );

  return allocationCountsRaw.map((item) => {
    const examId = String(item._id.examId);
    const hallId = String(item._id.hallId);
    const allocatedCount = Number(item.allocatedCount || 0);
    const presentCount = Number(attendanceMap.get(`${examId}:${hallId}`) || 0);

    return {
      examId,
      hallId,
      subjectCode: examIdToSubject.get(examId) || 'UNKNOWN',
      allocatedCount,
      presentCount,
      attendanceRate: allocatedCount > 0 ? presentCount / allocatedCount : 0
    };
  });
}

async function runHallPredictionScript(
  rows: ForecastFeatureRow[]
): Promise<ForecastPrediction[] | null> {
  if (!rows.length) {
    return [];
  }

  const pythonBin = process.env.ML_PYTHON_BIN || 'python';
  const modelPath = process.env.ML_HALL_MODEL_PATH || defaultModelPath;
  const scriptPath =
    process.env.ML_HALL_PREDICT_SCRIPT || defaultPredictScriptPath;

  if (!existsSync(scriptPath) || !existsSync(modelPath)) {
    return null;
  }

  return new Promise((resolvePromise) => {
    const child = spawn(pythonBin, [scriptPath, '--model', modelPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', () => {
      resolvePromise(null);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        console.error('Hall forecast prediction failed:', stderr);
        resolvePromise(null);
        return;
      }

      try {
        const parsed = JSON.parse(stdout) as {
          predictions?: ForecastPrediction[];
        };
        resolvePromise(parsed.predictions || null);
      } catch (error) {
        console.error('Failed to parse hall forecast output', error);
        resolvePromise(null);
      }
    });

    child.stdin.write(JSON.stringify({ rows }));
    child.stdin.end();
  });
}

function buildFallbackRate(args: {
  subjectCode: string;
  hallId: string;
  allocatedCount: number;
  hallCapacity: number;
  historicalSamples: HistoricalSample[];
}): { rate: number; historyCount: number } {
  const {
    subjectCode,
    hallId,
    allocatedCount,
    hallCapacity,
    historicalSamples
  } = args;

  const subjectSamples = historicalSamples.filter(
    (item) => item.subjectCode === subjectCode
  );
  const hallSamples = historicalSamples.filter((item) => item.hallId === hallId);
  const globalSamples = historicalSamples;

  const subjectAverage = average(subjectSamples.map((item) => item.attendanceRate));
  const hallAverage = average(hallSamples.map((item) => item.attendanceRate));
  const globalAverage = average(globalSamples.map((item) => item.attendanceRate));

  const hallFillRatio = hallCapacity > 0 ? allocatedCount / hallCapacity : 0;

  const weightedAverage =
    (subjectSamples.length ? subjectAverage * 0.45 : 0) +
    (hallSamples.length ? hallAverage * 0.35 : 0) +
    ((subjectSamples.length || hallSamples.length ? 0.2 : 1) *
      (globalAverage || 0.78));

  const blended = weightedAverage * 0.85 + clamp(hallFillRatio, 0.25, 1) * 0.15;

  return {
    rate: clamp(blended || globalAverage || 0.78, 0.35, 0.99),
    historyCount: Math.max(
      subjectSamples.length,
      hallSamples.length,
      globalSamples.length
    )
  };
}

async function getSessionCapacityCount(dayExams: Array<any>): Promise<number> {
  if (!dayExams.length) return 0;

  const allHallIds = dayExams.flatMap((exam) =>
    Array.isArray(exam.hallIds) ? exam.hallIds.map((hallId: any) => String(hallId)) : []
  );

  if (!allHallIds.length) return 0;

  const uniqueHallIds = Array.from(new Set(allHallIds));

  const halls = await Hall.find({ _id: { $in: uniqueHallIds } })
    .select('_id capacity')
    .lean();

  const hallCapacityMap = new Map(
    halls.map((hall) => [String(hall._id), Number(hall.capacity || 0)])
  );

  return allHallIds.reduce((sum, hallId) => {
    return sum + Number(hallCapacityMap.get(String(hallId)) || 0);
  }, 0);
}

export async function getHistoricalAttendanceTrend(
  limit = 10
): Promise<DashboardTrendPoint[]> {
  const exams = await Exam.find({}).sort({ examDate: 1, startTime: 1 }).lean();
  if (!exams.length) return [];

  const groupedByDate = new Map<string, typeof exams>();

  for (const exam of exams) {
    const bucket = groupedByDate.get(exam.examDate) || [];
    bucket.push(exam);
    groupedByDate.set(exam.examDate, bucket);
  }

  const dates = Array.from(groupedByDate.keys()).sort().slice(-limit);
  const points: DashboardTrendPoint[] = [];

  for (const date of dates) {
    const dayExams = groupedByDate.get(date) || [];
    const examIds = dayExams.map((exam) => exam._id);

    const [allocatedCount, presentCount, capacityCount] = await Promise.all([
      SeatAllocation.countDocuments({ examId: { $in: examIds } }),
      Attendance.countDocuments({ examId: { $in: examIds } }),
      getSessionCapacityCount(dayExams)
    ]);

    const attendanceRate =
      allocatedCount > 0 ? (presentCount / allocatedCount) * 100 : 0;

    const occupancyRate =
      capacityCount > 0 ? (allocatedCount / capacityCount) * 100 : 0;

    points.push({
      date,
      examCount: dayExams.length,
      allocatedCount,
      presentCount,
      attendanceRate: round2(attendanceRate),
      capacityCount,
      occupancyRate: round2(occupancyRate)
    });
  }

  return points;
}

export async function getUpcomingHallForecast(
  limit = 10
): Promise<DashboardForecastItem[]> {
  const today = new Date().toISOString().slice(0, 10);

  const upcomingExams = await Exam.find({ examDate: { $gte: today } })
    .sort({ examDate: 1, startTime: 1 })
    .populate('hallIds', 'name building floor capacity rows columns')
    .lean();

  if (!upcomingExams.length) return [];

  const historicalSamples = await buildHistoricalSamples();
  const featureRows: ForecastFeatureRow[] = [];
  const forecastItems: Omit<
    DashboardForecastItem,
    | 'predictedPresentCount'
    | 'predictedAttendanceRate'
    | 'predictedOccupancyRate'
    | 'predictionBasis'
    | 'confidenceLabel'
  >[] = [];
  const historyCountByKey = new Map<string, number>();

  for (const exam of upcomingExams.slice(0, limit)) {
    const halls = (exam.hallIds || []) as unknown as Array<{
      _id: unknown;
      name: string;
      building: string;
      floor: string;
      capacity: number;
    }>;

    for (const hall of halls) {
      const allocations = await SeatAllocation.find({
        examId: exam._id,
        hallId: hall._id
      })
        .populate('studentId', 'program semester')
        .lean();

      const allocatedCount = allocations.length;
      const dominantProgramMap = new Map<string, number>();
      const semesters: number[] = [];
      const rows: number[] = [];
      const columns: number[] = [];

      for (const allocation of allocations as Array<any>) {
        const student = allocation.studentId as
          | { program?: string; semester?: number }
          | undefined;

        const program = student?.program || 'Unknown';
        dominantProgramMap.set(
          program,
          Number(dominantProgramMap.get(program) || 0) + 1
        );

        if (typeof student?.semester === 'number') {
          semesters.push(student.semester);
        }

        if (typeof allocation.row === 'number') {
          rows.push(allocation.row);
        }

        if (typeof allocation.column === 'number') {
          columns.push(allocation.column);
        }
      }

      const dominantProgram =
        Array.from(dominantProgramMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
        'Unknown';

      featureRows.push({
        exam_id: String(exam._id),
        hall_id: String(hall._id),
        exam_subject_code: exam.subjectCode,
        exam_day_of_week: getDayOfWeek(exam.examDate),
        exam_month: getMonthNumber(exam.examDate),
        exam_start_hour: getStartHour(exam.startTime),
        exam_duration_minutes: Number(exam.durationMinutes || 0),
        hall_name: hall.name,
        hall_building: hall.building,
        hall_floor: hall.floor,
        hall_capacity: Number(hall.capacity || 0),
        allocated_count: allocatedCount,
        dominant_program: dominantProgram,
        avg_semester: average(semesters),
        avg_seat_row: average(rows),
        avg_seat_column: average(columns),
        hall_fill_ratio: hall.capacity > 0 ? allocatedCount / hall.capacity : 0
      });

      forecastItems.push({
        examId: String(exam._id),
        examTitle: exam.title,
        subjectCode: exam.subjectCode,
        examDate: exam.examDate,
        startTime: exam.startTime,
        hallId: String(hall._id),
        hallName: hall.name,
        hallBuilding: hall.building,
        hallFloor: hall.floor,
        hallCapacity: Number(hall.capacity || 0),
        allocatedCount
      });

      const historyCount = historicalSamples.filter(
        (sample) =>
          sample.subjectCode === exam.subjectCode ||
          sample.hallId === String(hall._id)
      ).length;

      historyCountByKey.set(`${String(exam._id)}:${String(hall._id)}`, historyCount);
    }
  }

  const mlPredictions = await runHallPredictionScript(featureRows);

  return forecastItems.map((item, index) => {
    const mlRate = mlPredictions?.[index]?.attendance_rate;
    const basis: 'ml' | 'fallback' = typeof mlRate === 'number' ? 'ml' : 'fallback';

    const fallback = buildFallbackRate({
      subjectCode: item.subjectCode,
      hallId: item.hallId,
      allocatedCount: item.allocatedCount,
      hallCapacity: item.hallCapacity,
      historicalSamples
    });

    const predictedAttendanceRate = round2(
      clamp((typeof mlRate === 'number' ? mlRate : fallback.rate) * 100, 0, 100)
    );

    const predictedPresentCount = Math.min(
      item.allocatedCount,
      Math.max(0, Math.round((predictedAttendanceRate / 100) * item.allocatedCount))
    );

    const predictedOccupancyRate = item.hallCapacity
      ? round2((predictedPresentCount / item.hallCapacity) * 100)
      : 0;

    return {
      ...item,
      predictedPresentCount,
      predictedAttendanceRate,
      predictedOccupancyRate,
      predictionBasis: basis,
      confidenceLabel: getConfidenceLabel(
        historyCountByKey.get(`${item.examId}:${item.hallId}`) || fallback.historyCount,
        basis
      )
    };
  });
}