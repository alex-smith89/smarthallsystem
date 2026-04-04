import asyncHandler from 'express-async-handler';
import type { Request, Response } from 'express';
import { User } from '../models/User.js';
import { generateToken } from '../utils/generateToken.js';

export const loginUser = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400);
    throw new Error('Email and password are required');
  }

  const user = (await User.findOne({ email: email.toLowerCase() }).select('+password')) as any;

  if (!user || !(await user.comparePassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  res.json({
    success: true,
    data: {
      token: generateToken(user._id.toString()),
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    }
  });
});

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401);
    throw new Error('Not authorized');
  }

  res.json({
    success: true,
    data: {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role
    }
  });
});