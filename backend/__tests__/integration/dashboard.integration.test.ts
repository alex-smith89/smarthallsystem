import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app.js';
import { login, seedAdmin } from './helpers';
import {
  getHistoricalAttendanceTrend,
  getUpcomingHallForecast
} from '../../src/services/hallOccupancyForecast.service.js';

jest.mock('../../src/socket.js', () => ({
  getIO: () => ({
    emit: jest.fn()
  })
}));

jest.mock('../../src/services/hallOccupancyForecast.service.js', () => ({
  getHistoricalAttendanceTrend: jest.fn(),
  getUpcomingHallForecast: jest.fn()
}));

const mockedGetHistoricalAttendanceTrend =
  getHistoricalAttendanceTrend as jest.MockedFunction<typeof getHistoricalAttendanceTrend>;

const mockedGetUpcomingHallForecast =
  getUpcomingHallForecast as jest.MockedFunction<typeof getUpcomingHallForecast>;

describe('Dashboard integration', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await seedAdmin();

    mockedGetHistoricalAttendanceTrend.mockResolvedValue([] as any);
    mockedGetUpcomingHallForecast.mockResolvedValue([] as any);
  });

  test('returns dashboard summary after core workflow data exists', async () => {
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

    expect(studentRes.status).toBe(201);
    expect(studentRes.body.success).toBe(true);

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

    expect(hallRes.status).toBe(201);
    expect(hallRes.body.success).toBe(true);

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

    expect(examRes.status).toBe(201);
    expect(examRes.body.success).toBe(true);

    const allocationRes = await request(app)
      .post('/api/allocations/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ examId: examRes.body.data._id });

    expect(allocationRes.status).toBe(200);
    expect(allocationRes.body.success).toBe(true);

    const dashboardRes = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(dashboardRes.status).toBe(200);
    expect(dashboardRes.body.success).toBe(true);
    expect(dashboardRes.body.data.cards.totalStudents).toBe(1);
    expect(dashboardRes.body.data.cards.totalExams).toBe(1);
  });
});