export type Role = 'admin' | 'invigilator';

export type User = {
  _id: string;
  name: string;
  email: string;
  role: Role;
};

export type Student = {
  _id: string;
  fullName: string;
  rollNumber: string;
  email: string;
  program: string;
  semester: number;
  qrCodeValue: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type Hall = {
  _id: string;
  name: string;
  building: string;
  floor: string;
  capacity: number;
  rows: number;
  columns: number;
  seatPrefix?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ExamStatus = 'scheduled' | 'active' | 'completed';

export type Exam = {
  _id: string;
  title: string;
  subjectCode: string;
  examDate: string;
  startTime: string;
  endTime: string;
  status: ExamStatus;
  hallIds: Hall[];
  studentIds: Student[];
  createdBy?: User;
  createdAt?: string;
  updatedAt?: string;
};

export type SeatAllocation = {
  _id: string;
  examId: string;
  studentId: Student;
  hallId: Hall;
  seatNumber: string;
  row: number;
  column: number;
  qrCodeValue: string;
  allocatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AttendanceRecord = {
  _id: string;
  examId: string;
  studentId: Student;
  hallId: Hall;
  seatAllocationId: string;
  qrCodeValue: string;
  status: 'present' | 'absent';
  scanMethod: 'qr' | 'manual' | 'offline-sync';
  scannedAt: string;
  scannedBy?: User;
  notes?: string;
};

export type ScanLog = {
  _id: string;
  examId: string;
  studentId?: Student;
  hallId?: Hall;
  qrCodeValue: string;
  result: 'valid' | 'duplicate' | 'invalid' | 'manual';
  message: string;
  scannedBy?: User;
  createdAt: string;
};

export type DashboardSummaryResponse = {
  exam?: {
    _id: string;
    title: string;
    subjectCode: string;
    examDate: string;
    startTime: string;
    endTime: string;
    status: ExamStatus;
  };
  summary?: {
    assigned: number;
    present: number;
    absent: number;
    progress: number;
  };
  hallOccupancy?: Array<{
    hallName: string;
    capacity: number;
    assigned: number;
    present: number;
  }>;
  warnings?: Array<{
    id: string;
    result: string;
    message: string;
    qrCodeValue: string;
    student?: Student;
    createdAt: string;
  }>;
  examCount?: number;
  allocationCount?: number;
  attendanceCount?: number;
  message?: string;
};

export type AttendanceByExamResponse = {
  attendance: AttendanceRecord[];
  logs: ScanLog[];
};

export type LoginResponse = {
  token: string;
  user: User;
};

export type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  warning?: boolean;
  count?: number;
  data: T;
};

export type OfflineSyncResult = {
  qrCodeValue: string;
  success: boolean;
  message: string;
};