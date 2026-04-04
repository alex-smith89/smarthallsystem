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

export type AttendanceStatus = 'present' | 'absent';
export type AttendanceScanMethod = 'qr' | 'manual' | 'offline-sync';

export type AttendanceRecord = {
  _id: string;
  examId: string;
  studentId: Student;
  hallId: Hall;
  seatAllocationId: string;
  qrCodeValue: string;
  status: AttendanceStatus;
  scanMethod: AttendanceScanMethod;
  scannedAt: string;
  scannedBy?: User;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ScanLogResult = 'valid' | 'duplicate' | 'invalid' | 'manual';

export type ScanLog = {
  _id: string;
  examId: string;
  studentId?: Student;
  hallId?: Hall;
  qrCodeValue: string;
  result: ScanLogResult;
  message: string;
  scannedBy?: User;
  createdAt: string;
  updatedAt?: string;
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
  scanStats?: {
    valid: number;
    duplicate: number;
    invalid: number;
    manual: number;
  };
  hallOccupancy?: Array<{
    hallId: string;
    hallName: string;
    capacity: number;
    assigned: number;
    present: number;
    vacant: number;
    occupancyPercent: number;
  }>;
  seatingCharts?: Array<{
    hallId: string;
    hallName: string;
    seats: Array<{
      seatNumber: string;
      row: number;
      column: number;
      studentName: string;
      rollNumber: string;
      present: boolean;
    }>;
  }>;
  recentAttendance?: Array<{
    id: string;
    scannedAt: string;
    scanMethod: AttendanceScanMethod;
    studentName: string;
    rollNumber: string;
    hallName: string;
    scannedBy: string;
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
  warningCount?: number;
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

export type ExamReport = {
  generatedAt: string;
  exam: {
    _id: string;
    title: string;
    subjectCode: string;
    examDate: string;
    startTime: string;
    endTime: string;
    status: ExamStatus;
  };
  summary: {
    assigned: number;
    present: number;
    absent: number;
    progress: number;
    duplicateScanCount: number;
    invalidScanCount: number;
    manualAttendanceCount: number;
    offlineSyncCount: number;
  };
  hallOccupancy: Array<{
    hallId: string;
    hallName: string;
    capacity: number;
    assigned: number;
    present: number;
    vacant: number;
    occupancyPercent: number;
  }>;
  attendanceByMethod: Array<{
    method: AttendanceScanMethod;
    count: number;
  }>;
  seatingCharts: Array<{
    hallId: string;
    hallName: string;
    seats: Array<{
      seatNumber: string;
      row: number;
      column: number;
      studentId: string;
      studentName: string;
      rollNumber: string;
      program: string;
      semester: number;
      status: AttendanceStatus;
      scanMethod: AttendanceScanMethod | null;
      scannedAt: string | null;
    }>;
  }>;
  absentStudents: Array<{
    studentId: string;
    fullName: string;
    rollNumber: string;
    program: string;
    semester: number;
    hallName: string;
    seatNumber: string;
  }>;
  warningLogs: Array<{
    id: string;
    result: string;
    message: string;
    hallName: string;
    studentName: string;
    rollNumber: string;
    createdAt: string;
    scannedBy: string;
  }>;
  attendanceRecords: Array<{
    id: string;
    fullName: string;
    rollNumber: string;
    hallName: string;
    scanMethod: AttendanceScanMethod;
    scannedAt: string;
    scannedBy: string;
  }>;
};