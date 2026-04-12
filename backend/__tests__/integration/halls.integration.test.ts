import { beforeEach, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app.js';
import { login, seedAdmin } from './helpers';

describe('Halls integration', () => {
  beforeEach(async () => {
    await seedAdmin();
  });

  test('creates and lists halls', async () => {
    const token = await login('admin@example.com', 'Admin123!');

    const createRes = await request(app)
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

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);

    const listRes = await request(app)
      .get('/api/halls')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(1);
  });
});