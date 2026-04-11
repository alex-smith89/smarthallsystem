import { buildQrPayload, parseQrPayload } from '../../src/utils/qr.js';

describe('qr utils', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, QR_SECRET: 'unit-test-secret' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('builds a signed payload that can be parsed back', () => {
    const raw = buildQrPayload({
      type: 'student-attendance',
      studentId: 'student_1',
      rollNumber: 'CSE-01',
      examId: 'exam_1'
    });

    const parsed = parseQrPayload(raw);

    expect(parsed).toMatchObject({
      type: 'student-attendance',
      studentId: 'student_1',
      rollNumber: 'CSE-01',
      examId: 'exam_1'
    });
    expect(typeof parsed?.issuedAt).toBe('string');
    expect(typeof parsed?.sig).toBe('string');
  });

  test('accepts legacy unsigned payloads when required fields are present', () => {
    const parsed = parseQrPayload(
      JSON.stringify({
        type: 'student-attendance',
        studentId: 'student_2',
        rollNumber: 'CSE-02'
      })
    );

    expect(parsed).toEqual({
      type: 'student-attendance',
      studentId: 'student_2',
      rollNumber: 'CSE-02'
    });
  });

  test('returns null for tampered or malformed payloads', () => {
    const raw = buildQrPayload({
      type: 'student-attendance',
      studentId: 'student_3',
      rollNumber: 'CSE-03'
    });

    const tampered = JSON.stringify({
      ...JSON.parse(raw),
      rollNumber: 'CSE-99'
    });

    expect(parseQrPayload(tampered)).toBeNull();
    expect(parseQrPayload('{bad json')).toBeNull();
    expect(parseQrPayload(JSON.stringify({ type: 'wrong-type' }))).toBeNull();
  });
});