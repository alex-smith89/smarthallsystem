import { createServer } from 'http';
import dotenv from 'dotenv';
import { app } from './app.js';
import { connectDB } from './config/db.js';
import { initSocket } from './socket.js';

dotenv.config();

const port = Number(process.env.PORT || 5000);

async function startServer() {
  await connectDB();
  const server = createServer(app);
  initSocket(server);

  server.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});