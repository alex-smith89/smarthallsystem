import type {
  ApiEnvelope,
  AttendanceByExamResponse,
  AttendanceRecord,
  DashboardSummaryResponse,
  Exam,
  Hall,
  LoginResponse,
  OfflineSyncResult,
  ScanLog,
  SeatAllocation,
  Student,
  User
} from '../types';
import { getStoredToken } from '../utils/storage';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string | null;
};

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const token = options.token ?? getStoredToken();

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
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
    request<Student>('/students', { method: 'POST', body: payload }),
  updateStudent: async (
    id: string,
    payload: Partial<Omit<Student, '_id' | 'qrCodeValue'>>
  ) => request<Student>(`/students/${id}`, { method: 'PUT', body: payload }),
  deleteStudent: async (id: string) => request<{ message: string }>(`/students/${id}`, { method: 'DELETE' }),

  getHalls: async () => request<Hall[]>('/halls'),
  createHall: async (payload: Omit<Hall, '_id'>) =>
    request<Hall>('/halls', { method: 'POST', body: payload }),
  updateHall: async (id: string, payload: Partial<Omit<Hall, '_id'>>) =>
    request<Hall>(`/halls/${id}`, { method: 'PUT', body: payload }),
  deleteHall: async (id: string) => request<{ message: string }>(`/halls/${id}`, { method: 'DELETE' }),

  getExams: async () => request<Exam[]>('/exams'),
  createExam: async (payload: {
    title: string;
    subjectCode: string;
    examDate: string;
    startTime: string;
    endTime: string;
    hallIds: string[];
    studentIds: string[];
  }) => request<Exam>('/exams', { method: 'POST', body: payload }),
  updateExam: async (
    id: string,
    payload: Partial<{
      title: string;
      subjectCode: string;
      examDate: string;
      startTime: string;
      endTime: string;
      status: string;
      hallIds: string[];
      studentIds: string[];
    }>
  ) => request<Exam>(`/exams/${id}`, { method: 'PUT', body: payload }),
  deleteExam: async (id: string) => request<{ message: string }>(`/exams/${id}`, { method: 'DELETE' }),

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
    request<DashboardSummaryResponse>(`/dashboard/summary${examId ? `?examId=${examId}` : ''}`)
};

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong';
}

export function formatDateTime(value?: string): string {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString();
}

export function formatDate(value?: string): string {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleDateString();
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