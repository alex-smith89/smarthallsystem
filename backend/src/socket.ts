import type { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';

let io: Server | null = null;

export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true
    }
  });

  io.on('connection', (socket: Socket) => {
    socket.on('dashboard:join', (examId?: string) => {
      if (examId) {
        socket.join(`exam:${examId}`);
      }
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.io has not been initialized');
  }

  return io;
}