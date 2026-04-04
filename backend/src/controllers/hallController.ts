import asyncHandler from 'express-async-handler';
import type { Request, Response } from 'express';
import { Hall } from '../models/Hall.js';

function normalizeHallPayload(payload: Record<string, unknown>) {
  return {
    name: typeof payload.name === 'string' ? payload.name.trim() : '',
    building: typeof payload.building === 'string' ? payload.building.trim() : '',
    floor: typeof payload.floor === 'string' ? payload.floor.trim() : '',
    capacity: Number(payload.capacity),
    rows: Number(payload.rows),
    columns: Number(payload.columns),
    seatPrefix: typeof payload.seatPrefix === 'string' ? payload.seatPrefix.trim() : undefined
  };
}

function validateHallInput(hall: ReturnType<typeof normalizeHallPayload>, res: Response) {
  if (!hall.name || !hall.building || !hall.floor) {
    res.status(400);
    throw new Error('Hall name, building, and floor are required');
  }

  if (!Number.isInteger(hall.capacity) || !Number.isInteger(hall.rows) || !Number.isInteger(hall.columns)) {
    res.status(400);
    throw new Error('Capacity, rows, and columns must be whole numbers');
  }

  if (hall.capacity < 1 || hall.rows < 1 || hall.columns < 1) {
    res.status(400);
    throw new Error('Capacity, rows, and columns must be greater than zero');
  }

  if (hall.rows * hall.columns < hall.capacity) {
    res.status(400);
    throw new Error('Rows × columns must be enough to represent the hall capacity');
  }
}

export const getHalls = asyncHandler(async (_req: Request, res: Response) => {
  const halls = await Hall.find().sort({ name: 1 });
  res.json({ success: true, count: halls.length, data: halls });
});

export const createHall = asyncHandler(async (req: Request, res: Response) => {
  const normalized = normalizeHallPayload(req.body as Record<string, unknown>);
  validateHallInput(normalized, res);

  const existing = await Hall.findOne({ name: normalized.name });
  if (existing) {
    res.status(409);
    throw new Error('A hall with the same name already exists');
  }

  const hall = await Hall.create(normalized);

  res.status(201).json({ success: true, data: hall });
});

export const updateHall = asyncHandler(async (req: Request, res: Response) => {
  const hall = await Hall.findById(req.params.id);

  if (!hall) {
    res.status(404);
    throw new Error('Hall not found');
  }

  const normalized = normalizeHallPayload({ ...hall.toObject(), ...req.body });
  validateHallInput(normalized, res);

  if (normalized.name !== hall.name) {
    const existing = await Hall.findOne({ name: normalized.name, _id: { $ne: hall._id } });
    if (existing) {
      res.status(409);
      throw new Error('Another hall already uses that name');
    }
  }

  Object.assign(hall, normalized);
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