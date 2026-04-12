import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app.js';
import { login, seedAdmin } from './helpers';

jest.mock('../../src/socket.js', () => ({
  getIO: () => ({
    emit: jest.fn()
  })
}));

describe('Reports integration', () => {
  beforeEach(async () => {
    await seedAdmin();
  });

  test('returns exam report after allocation and attendance', async () => {
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
        studentIds: [studentRes.body.data._id]
      });

    const examId = examRes.body.data._id;
    const studentId = studentRes.body.data._id;

    await request(app)
      .post('/api/allocations/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ examId });

    await request(app)
      .post('/api/attendance/manual')
      .set('Authorization', `Bearer ${token}`)
      .send({
        examId,
        studentId,
        notes: 'Checked manually'
      });

    const reportRes = await request(app)
      .get(`/api/reports/exam/${examId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(reportRes.status).toBe(200);
    expect(reportRes.body.success).toBe(true);
    expect(reportRes.body.data.summary.assigned).toBe(1);
    expect(reportRes.body.data.summary.present).toBe(1);
  });
});