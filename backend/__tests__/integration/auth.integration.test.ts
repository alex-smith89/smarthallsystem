import { beforeEach, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app.js';
import { seedAdmin } from './helpers';

describe('Auth integration', () => {
  beforeEach(async () => {
    await seedAdmin();
  });

  test('logs in and fetches current profile', async () => {
    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'admin@example.com',
      password: 'Admin123!'
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.token).toBeTruthy();

    const token = loginRes.body.data.token;

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.success).toBe(true);
    expect(meRes.body.data.email).toBe('admin@example.com');
  });

  test('rejects invalid login', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'admin@example.com',
      password: 'WrongPassword123'
    });

    expect(res.status).toBe(401);
  });
});