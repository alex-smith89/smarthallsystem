import type { NextFunction, Request, Response } from 'express';

export function notFound(req: Request, res: Response, next: NextFunction): void {
  res.status(404);
  next(new Error(`Route not found: ${req.originalUrl}`));
}

export function errorHandler(
  err: Error & { code?: number; keyPattern?: Record<string, unknown>; path?: string },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  if (err.code === 11000) {
    statusCode = statusCode === 500 ? 409 : statusCode;
    const fields = Object.keys(err.keyPattern || {});
    message = fields.length
      ? `Duplicate value detected for: ${fields.join(', ')}`
      : 'Duplicate value detected';
  }

  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid identifier for field: ${err.path || 'unknown'}`;
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
}