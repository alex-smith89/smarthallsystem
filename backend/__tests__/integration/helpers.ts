import request from 'supertest';
import { app } from '../../src/app.js';
import { User } from '../../src/models/User.js';

export async function seedAdmin() {
  await User.create({
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'Admin123!',
    role: 'admin'
  });
}

export async function seedInvigilator() {
  await User.create({
    name: 'Invigilator User',
    email: 'invigilator@example.com',
    password: 'Invigilator123!',
    role: 'invigilator'
  });
}

export async function login(email: string, password: string) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.data.token as string;
}