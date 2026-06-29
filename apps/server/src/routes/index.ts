import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import authRouter from './auth';
import usersRouter from './users';
import vehiclesRouter from './vehicles';
import vendorsRouter from './vendors';
import auctionsRouter from './auctions';
import partsRouter from './parts';
import emailLogRouter from './email-log';
import reportsRouter from './reports';
import uploadsRouter from './uploads';
import emailSendRouter from './email-send';
import paymentsRouter from './payments';
import devRouter from './dev';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — try again in 15 minutes' },
});

const router = Router();

router.use(apiLimiter);
router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/vehicles', vehiclesRouter);
router.use('/vendors', vendorsRouter);
router.use('/auctions', auctionsRouter);
router.use('/parts', partsRouter);
router.use('/email-log', emailLogRouter);
router.use('/reports', reportsRouter);
router.use('/uploads', uploadsRouter);
router.use('/email', emailSendRouter);
router.use('/payments', paymentsRouter);

if (process.env.NODE_ENV !== 'production') {
  router.use('/dev', devRouter);
}

export default router;
