import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import morgan from 'morgan';
import authRoutes from './routes/authRoutes';
import studentRoutes from './routes/studentRoutes';
import hallRoutes from './routes/hallRoutes';
import examRoutes from './routes/examRoutes';
import allocationRoutes from './routes/allocationRoutes';
import attendanceRoutes from './routes/attendanceRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import { errorHandler, notFound } from './middleware/errorMiddleware';

dotenv.config();

export const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Smart Exam Hall API is running'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/halls', hallRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/allocations', allocationRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use(notFound);
app.use(errorHandler);