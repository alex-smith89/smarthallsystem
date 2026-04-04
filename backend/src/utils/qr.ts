export type QrPayload = {
  type: 'student-attendance';
  studentId: string;
  rollNumber: string;
  examId?: string;
};

export function buildQrPayload(payload: QrPayload): string {
  return JSON.stringify(payload);
}

export function parseQrPayload(raw: string): QrPayload | null {
  try {
    const parsed = JSON.parse(raw) as QrPayload;
    if (parsed.type !== 'student-attendance' || !parsed.studentId || !parsed.rollNumber) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}