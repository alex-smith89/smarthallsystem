import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app.js';
import { login, seedAdmin } from './helpers';

jest.mock('../../src/socket.js', () => ({
  getIO: () => ({
    emit: jest.fn()
  })
}));

describe('Attendance integration', () => {
  beforeEach(async () => {
    await seedAdmin();
  });

  test('marks manual attendance and detects duplicate QR scan', async () => {
    const token = await login('admin@example.com', 'Admin123!');
    const today = new Date().toISOString().slice(0, 10);

    const studentRes = await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Aayan Razz',
        rollNumber: 'BSC900',
        email: 'aayan.razz@example.com',
        program: 'BSc CSIT',
        semester: 8
      });

    const studentId = studentRes.body.data._id;
    const studentQrCode = studentRes.body.data.qrCodeValue;

    const hallRes = await request(app)
      .post('/api/halls')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Hall Z',
        building: 'Block 9',
        floor: 'Second Floor',
        capacity: 10,
        rows: 2,
        columns: 5,
        seatPrefix: 'Z'
      });

    const examRes = await request(app)
      .post('/api/exams')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Compiler Design Final Exam',
        subjectCode: 'CSC499',
        examDate: today,
        startTime: '10:00',
        endTime: '12:00',
        durationMinutes: 120,
        hallIds: [hallRes.body.data._id],
        studentIds: [studentId]
      });

    const examId = examRes.body.data._id;

    await request(app)
      .post('/api/allocations/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ examId });

    const manualRes = await request(app)
      .post('/api/attendance/manual')
      .set('Authorization', `Bearer ${token}`)
      .send({
        examId,
        studentId,
        notes: 'Checked manually'
      });

    expect(manualRes.status).toBe(200);
    expect(manualRes.body.success).toBe(true);

    const duplicateRes = await request(app)
      .post('/api/attendance/scan')
      .set('Authorization', `Bearer ${token}`)
      .send({
        examId,
        qrCodeValue: studentQrCode
      });

    expect(duplicateRes.status).toBe(200);
    expect(duplicateRes.body.success).toBe(true);
    expect(duplicateRes.body.warning).toBe(true);
  });
});