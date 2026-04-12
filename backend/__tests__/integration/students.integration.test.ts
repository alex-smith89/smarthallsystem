import { beforeEach, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app.js';
import { login, seedAdmin } from './helpers';

describe('Students integration', () => {
  beforeEach(async () => {
    await seedAdmin();
  });

  test('creates and lists students', async () => {
    const token = await login('admin@example.com', 'Admin123!');

    const createRes = await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Aayan Razz',
        rollNumber: 'BSC900',
        email: 'aayan.razz@example.com',
        program: 'BSc CSIT',
        semester: 8
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);

    const listRes = await request(app)
      .get('/api/students')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(1);
  });
});