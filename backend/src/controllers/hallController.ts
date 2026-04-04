import asyncHandler from 'express-async-handler';
import type { Request, Response } from 'express';
import { Hall } from '../models/Hall.js';

export const getHalls = asyncHandler(async (_req: Request, res: Response) => {
  const halls = await Hall.find().sort({ name: 1 });
  res.json({ success: true, count: halls.length, data: halls });
});

export const createHall = asyncHandler(async (req: Request, res: Response) => {
  const { name, building, floor, capacity, rows, columns, seatPrefix } = req.body;

  if (!name || !building || !floor || !capacity || !rows || !columns) {
    res.status(400);
    throw new Error('All hall fields are required');
  }

  const hall = await Hall.create({
    name,
    building,
    floor,
    capacity,
    rows,
    columns,
    seatPrefix
  });

  res.status(201).json({ success: true, data: hall });
});

export const updateHall = asyncHandler(async (req: Request, res: Response) => {
  const hall = await Hall.findById(req.params.id);

  if (!hall) {
    res.status(404);
    throw new Error('Hall not found');
  }

  Object.assign(hall, req.body);
  await hall.save();

  res.json({ success: true, data: hall });
});

export const deleteHall = asyncHandler(async (req: Request, res: Response) => {
  const hall = await Hall.findById(req.params.id);

  if (!hall) {
    res.status(404);
    throw new Error('Hall not found');
  }

  await hall.deleteOne();
  res.json({ success: true, message: 'Hall deleted successfully' });
});