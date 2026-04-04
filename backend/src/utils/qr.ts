import crypto from 'crypto';

export type QrPayload = {
  type: 'student-attendance';
  studentId: string;
  rollNumber: string;
  examId?: string;
  issuedAt?: string;
  sig?: string;
};

type QrPayloadForSignature = Omit<QrPayload, 'sig'>;

function getQrSecret(): string {
  return process.env.QR_SECRET || process.env.JWT_SECRET || 'smart-exam-demo-secret';
}

function serializeForSignature(payload: QrPayloadForSignature): string {
  return JSON.stringify({
    type: payload.type,
    studentId: payload.studentId,
    rollNumber: payload.rollNumber,
    examId: payload.examId || '',
    issuedAt: payload.issuedAt || ''
  });
}

function createSignature(payload: QrPayloadForSignature): string {
  return crypto
    .createHmac('sha256', getQrSecret())
    .update(serializeForSignature(payload))
    .digest('hex');
}

export function buildQrPayload(payload: Omit<QrPayload, 'issuedAt' | 'sig'>): string {
  const base: QrPayloadForSignature = {
    ...payload,
    issuedAt: new Date().toISOString()
  };

  return JSON.stringify({
    ...base,
    sig: createSignature(base)
  });
}

export function parseQrPayload(raw: string): QrPayload | null {
  try {
    const parsed = JSON.parse(raw) as QrPayload;

    if (parsed.type !== 'student-attendance' || !parsed.studentId || !parsed.rollNumber) {
      return null;
    }

    const base: QrPayloadForSignature = {
      type: parsed.type,
      studentId: parsed.studentId,
      rollNumber: parsed.rollNumber,
      examId: parsed.examId,
      issuedAt: parsed.issuedAt
    };

    if (!parsed.sig) {
      return parsed;
    }

    if (createSignature(base) !== parsed.sig) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}