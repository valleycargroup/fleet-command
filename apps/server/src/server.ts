import http from 'http';
import app from './app';
import './config/env';

const PORT = process.env.PORT ?? 5001;

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`Fleet Command server running on http://localhost:${PORT}`);
  console.log(`======================================================\n`);
}).on('error', (err) => {
  console.error(`\nServer failed to start on port ${PORT}:`, (err as NodeJS.ErrnoException).message);
  if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} is already in use. Change SERVER_PORT in your .env file.`);
  }
});
