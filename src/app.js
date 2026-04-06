import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import prisma from './config/prismaClient.js';
import profileRoutes from './routes/profile.js';
import authRoutes from './routes/auth.js';
import routineRoutes from './routes/routines.js';
import contactRoutes from './routes/contact.js';

import authRoutes from './routes/auth.js';
import routineRoutes from './routes/routines.js';
import contactRoutes from './routes/contact.js';

const app = express();

app.set('etag', false);

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));


app.use(helmet());
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use('/api/routines/import/csv', express.text({ type: '*/*', limit: '1mb' }));

// ✅ Ruta de prueba para verificar conexión con Prisma
app.get('/test-db', async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error connecting to DB:', error);
    res.status(500).json({ success: false, error: 'Database connection failed' });
  }
});

// ✅ Rutas reales
app.use('/api/auth', authRoutes);
app.use('/api/routines', routineRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/profile', profileRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// Handler de errores global
app.use((err, req, res, next) => {
  if (err?.type === 'entity.parse.failed' || (err instanceof SyntaxError && 'body' in err)) {
    return res.status(400).json({ message: 'Invalid JSON payload' });
  }

  if (err?.statusCode === 400 && Array.isArray(err.details)) {
    return res.status(400).json({ message: 'Validation failed', details: err.details });
  }

  if (err?.name === 'JsonWebTokenError') {
    return res.status(401).json({ message: 'Invalid token' });
  }

  if (err?.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'Token expired' });
  }

  if (err?.code === 'P2002') {
    return res.status(409).json({ message: 'Unique constraint violated' });
  }

  if (err?.code === 'P2025') {
    return res.status(404).json({ message: 'Record not found' });
  }

  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';

  if (process.env.NODE_ENV !== 'test') {
    console.error(err);
  }

  res.status(status).json({ message });
});

export default app;