import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import prisma from './config/prismaClient.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

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

// ✅ Rutas reales (dejar los placeholders hasta que las creemos)
import authRoutes from './routes/auth.js';
import routineRoutes from './routes/routines.js';

app.use('/api/auth', authRoutes);
app.use('/api/routines', routineRoutes);

// ✅ Manejador de errores global
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

export default app;

