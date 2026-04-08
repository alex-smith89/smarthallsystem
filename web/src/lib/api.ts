import type {
  ApiEnvelope,
  AttendanceByExamResponse,
  AttendanceRecord,
  Exam,
  ExamReport,
  Hall,
  LoginResponse,
  OfflineSyncResult,
  ScanLog,
  SeatAllocation,
  Student,
  User
} from '../types';
import { clearAuthSession, getStoredToken } from '../utils/storage';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

type RequestOptions = {
  method?: RequestMethod;
  body?: unknown;
  token?: string | null;
};

export type DashboardHallRef =
  | string
  | {
      _id?: string;
      name: string;
    };

export type DashboardStudentRef =
  | string
  | {
      _id?: string;
    };

export type DashboardExamOverview = {
  _id: string;
  title: string;
  subjectCode: string;
  examDate: string;
  startTime: string;
  endTime: string;
  hallIds: DashboardHallRef[];
  studentIds: DashboardStudentRef[];
};

export type DashboardHallOccupancy = {
  examId: string;
  title: string;
  subjectCode: string;
  allocated: number;
  present: number;
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

export type DashboardHallForecastItem = {
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

export type DashboardStudentLogRef =
  | string
  | {
      _id?: string;
      fullName?: string;
      rollNumber?: string;
    };

export type DashboardRecentLog = {
  _id: string;
  result: string;
  message: string;
  createdAt: string;
  studentId: DashboardStudentLogRef;
};

export type DashboardCards = {
  totalStudents: number;
  activeStudents: number;
  totalHalls: number;
  totalExams: number;
  todayExams: number;
  todaySeatAllocations: number;
  todayPresent: number;
  scansToday: number;
  attendanceRate: number;
};

export type DashboardScans = {
  valid: number;
  invalid: number;
  duplicate: number;
  manual: number;
};

export type DashboardSummaryData = {
  cards: DashboardCards;
  scans: DashboardScans;
  todayExams: DashboardExamOverview[];
  hallOccupancy: DashboardHallOccupancy[];
  recentLogs: DashboardRecentLog[];
  trend: DashboardTrendPoint[];
  hallForecast: DashboardHallForecastItem[];
};

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    return null;
  }

  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function parseTextSafe(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiEnvelope<T>> {
  const token = options.token ?? getStoredToken();

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const json = await parseJsonSafe<ApiEnvelope<T>>(response);

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthSession();
    }

    const fallbackText = json?.message || response.statusText || 'Request failed';
    throw new Error(fallbackText);
  }

  if (!json) {
    throw new Error('Invalid server response');
  }

  return json;
}

async function requestText(endpoint: string): Promise<string> {
  const token = getStoredToken();

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  const text = await parseTextSafe(response);

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthSession();
    }

    throw new Error(text || response.statusText || 'Request failed');
  }

  return text;
}

export const api = {
  login: async (email: string, password: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
      token: null
    }),

  getProfile: async () => request<User>('/auth/me'),

  getStudents: async () => request<Student[]>('/students'),

  createStudent: async (payload: Omit<Student, '_id' | 'qrCodeValue'>) =>
    request<Student>('/students', {
      method: 'POST',
      body: payload
    }),

  updateStudent: async (
    id: string,
    payload: Partial<Omit<Student, '_id' | 'qrCodeValue'>>
  ) =>
    request<Student>(`/students/${id}`, {
      method: 'PUT',
      body: payload
    }),

  deleteStudent: async (id: string) =>
    request<{ message: string }>(`/students/${id}`, {
      method: 'DELETE'
    }),

  getHalls: async () => request<Hall[]>('/halls'),

  createHall: async (payload: Omit<Hall, '_id'>) =>
    request<Hall>('/halls', {
      method: 'POST',
      body: payload
    }),

  updateHall: async (id: string, payload: Partial<Omit<Hall, '_id'>>) =>
    request<Hall>(`/halls/${id}`, {
      method: 'PUT',
      body: payload
    }),

  deleteHall: async (id: string) =>
    request<{ message: string }>(`/halls/${id}`, {
      method: 'DELETE'
    }),

  getExams: async () => request<Exam[]>('/exams'),

  createExam: async (payload: {
    title: string;
    subjectCode: string;
    examDate: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    hallIds: string[];
    studentIds: string[];
  }) =>
    request<Exam>('/exams', {
      method: 'POST',
      body: payload
    }),

  updateExam: async (
    id: string,
    payload: Partial<{
      title: string;
      subjectCode: string;
      examDate: string;
      startTime: string;
      endTime: string;
      durationMinutes: number;
      status: string;
      hallIds: string[];
      studentIds: string[];
    }>
  ) =>
    request<Exam>(`/exams/${id}`, {
      method: 'PUT',
      body: payload
    }),

  deleteExam: async (id: string) =>
    request<{ message: string }>(`/exams/${id}`, {
      method: 'DELETE'
    }),

  generateAllocations: async (examId: string) =>
    request<SeatAllocation[]>('/allocations/generate', {
      method: 'POST',
      body: { examId }
    }),

  getAllocationsByExam: async (examId: string) =>
    request<SeatAllocation[]>(`/allocations/exam/${examId}`),

  scanAttendance: async (examId: string, qrCodeValue: string) =>
    request<AttendanceRecord>('/attendance/scan', {
      method: 'POST',
      body: { examId, qrCodeValue }
    }),

  markManualAttendance: async (examId: string, studentId: string, notes?: string) =>
    request<AttendanceRecord>('/attendance/manual', {
      method: 'POST',
      body: { examId, studentId, notes }
    }),

  syncOfflineAttendance: async (examId: string, qrCodeValues: string[]) =>
    request<OfflineSyncResult[]>('/attendance/sync-offline', {
      method: 'POST',
      body: { examId, qrCodeValues }
    }),

  getAttendanceByExam: async (examId: string) =>
    request<AttendanceByExamResponse>(`/attendance/exam/${examId}`),

  getDashboardSummary: async (examId?: string) =>
    request<DashboardSummaryData>(
      `/dashboard/summary${examId ? `?examId=${encodeURIComponent(examId)}` : ''}`
    ),

  getExamReport: async (examId: string) =>
    request<ExamReport>(`/reports/exam/${examId}`),

  downloadExamReportCsv: async (examId: string) =>
    requestText(`/reports/exam/${examId}?format=csv`)
};

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'Something went wrong';
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString();
}

export function formatDate(value?: string | null): string {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString();
}

export function groupLogsBySeverity(log: ScanLog): 'success' | 'warning' | 'error' {
  if (log.result === 'valid' || log.result === 'manual') {
    return 'success';
  }

  if (log.result === 'duplicate') {
    return 'warning';
  }

  return 'error';
}