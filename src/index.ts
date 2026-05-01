import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

import prisma from './config/database';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth.routes';
import { userRouter } from './routes/user.routes';
import { kennelRouter } from './routes/kennel.routes';
import { dogRouter } from './routes/dog.routes';
import { breedRouter } from './routes/breed.routes';
import { litterRouter } from './routes/litter.routes';
import { customerRouter } from './routes/customer.routes';
import { veterinarianRouter } from './routes/veterinarian.routes';
import { medicalRouter } from './routes/medical.routes';
import { reservationRouter } from './routes/reservation.routes';
import { reportRouter } from './routes/report.routes';
import { publicRouter } from './routes/public.routes';
import financeRouter from './routes/finance.routes';
import { calendarRouter } from './routes/calendar.routes';
import { documentRouter } from './routes/document.routes';
import messageRouter from './routes/message.routes';
import { taskRouter } from './routes/task.routes';
import { nutritionRouter } from './routes/nutrition.routes';
import { logisticsRouter } from './routes/logistics.routes';
import { staffRouter } from './routes/staff.routes';
import { showRouter } from './routes/show.routes';
import { geneticsRouter } from './routes/genetics.routes';
import { reviewsRouter } from './routes/reviews.routes';
import { inspectionRouter } from './routes/inspection.routes';
import { recipeRouter } from './routes/recipe.routes';
import { intoleranceRouter } from './routes/intolerance.routes';
import { feedingCostRouter } from './routes/feedingCost.routes';
import { clientReportRouter } from './routes/clientReport.routes';
import { assistantRouter } from './routes/assistant.routes';
import { activityRouter } from './routes/activity.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'https://criadero.vercel.app',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
    'http://localhost:5177',
    'http://localhost:5178',
    'http://localhost:5179',
    'http://localhost:5180',
    'http://localhost:8081',
    'http://localhost:8082',
    'http://localhost:8083',
    'http://localhost:19006',
    'http://localhost:19007',
    'http://localhost:3002',
  ],
  credentials: true,
}));

// Rate limiting (solo en produccion)
if (process.env.NODE_ENV === 'production') {
  const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' },
  });
  app.use(limiter);
}

const authLimiter = process.env.NODE_ENV === 'production'
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 50,
      message: { error: 'Too many login attempts, please try again later.' },
    })
  : (req: any, res: any, next: any) => next();

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/users', userRouter);
app.use('/api/kennels', kennelRouter);
app.use('/api/dogs', dogRouter);
app.use('/api/breeds', breedRouter);
app.use('/api/litters', litterRouter);
app.use('/api/customers', customerRouter);
app.use('/api/veterinarians', veterinarianRouter);
app.use('/api/medical', medicalRouter);
app.use('/api/reservations', reservationRouter);
app.use('/api/reports', reportRouter);
app.use('/api/finance', financeRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/documents', documentRouter);
app.use('/api/messages', messageRouter);
app.use('/api/tasks', taskRouter);
app.use('/api/nutrition', nutritionRouter);
app.use('/api/logistics', logisticsRouter);
app.use('/api/staff', staffRouter);
app.use('/api/shows', showRouter);
app.use('/api/genetics', geneticsRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/inspections', inspectionRouter);
app.use('/api/nutrition/recipes', recipeRouter);
app.use('/api/nutrition/intolerances', intoleranceRouter);
app.use('/api/nutrition/feeding-costs', feedingCostRouter);
app.use('/api/reports/client', clientReportRouter);
app.use('/api/assistant', assistantRouter);
app.use('/api/activity', activityRouter);
app.use('/api/public', publicRouter);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
