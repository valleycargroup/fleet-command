import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors, { CorsOptions } from 'cors';
import path from 'path';
import fs from 'fs';
import router from './routes';
import './config/env';

const CLIENT_PORT = process.env.CLIENT_PORT || 3000;

const app = express();
app.set('trust proxy', 1); // behind AWS ALB

const allowedOrigins = [
  `http://localhost:${CLIENT_PORT}`,
  'https://dev.fleetcommandrecon.net',
  'https://fleetcommandrecon.net',
  'https://www.fleetcommandrecon.net',
];

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[cors] blocked origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
  exposedHeaders: ['Accept-Ranges', 'Content-Range', 'Content-Length'],
};

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', (_req, res, next) => { res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); next(); }, express.static(uploadDir));

app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); }, router);

app.get('/health', (_req, res) =>
  res.json({ ok: true, message: 'Fleet Command API is running.', uptime: process.uptime() })
);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found', message: `Route ${_req.originalUrl} not found.` });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  const isDev = process.env.NODE_ENV === 'development';
  res.status(statusCode).json({
    error: 'Internal Server Error',
    ...(isDev && { message: err.message, stack: err.stack }),
  });
});

export default app;
