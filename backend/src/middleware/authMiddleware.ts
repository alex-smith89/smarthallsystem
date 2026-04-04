import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import type { NextFunction, Request, Response } from 'express';
import { User } from '../models/User.js';

export const protect = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401);
    throw new Error('Not authorized. Token missing.');
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(500);
    throw new Error('JWT secret is not configured');
  }

  const decoded = jwt.verify(token, secret) as { userId: string };
  const user = (await User.findById(decoded.userId)) as any;

  if (!user) {
    res.status(401);
    throw new Error('User not found or token invalid');
  }

  req.user = user;
  next();
});

export function authorize(...roles: Array<'admin' | 'invigilator'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401);
      throw new Error('Not authorized');
    }

    if (!roles.includes(req.user.role)) {
      res.status(403);
      throw new Error('You do not have permission to perform this action');
    }

    next();
  };
}