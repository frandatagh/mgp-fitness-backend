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
// 404 si ninguna ruta matchea (poner antes del handler de errores)
app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

// Handler de errores global (último middleware)
app.use((err, req, res, next) => {
  // 1) JSON inválido (body-parser)
  // express.json() lanza SyntaxError con estas props cuando el JSON está malformado
  if (err?.type === "entity.parse.failed" || (err instanceof SyntaxError && "body" in err)) {
    return res.status(400).json({ message: "Invalid JSON payload" });
  }

  // 2) Errores de validación (Zod)
  if (err?.statusCode === 400 && Array.isArray(err.details)) {
    return res.status(400).json({ message: "Validation failed", details: err.details });
  }

  // 3) JWT inválido/expirado
  if (err?.name === "JsonWebTokenError") {
    return res.status(401).json({ message: "Invalid token" });
  }
  if (err?.name === "TokenExpiredError") {
    return res.status(401).json({ message: "Token expired" });
  }

  // 4) Prisma (unicidad / no encontrado)
  // P2002: unique constraint (ej. email duplicado)
  if (err?.code === "P2002") {
    return res.status(409).json({ message: "Unique constraint violated" });
  }
  // P2025: record not found (útil si actualizas/eliminás por where y no existe)
  if (err?.code === "P2025") {
    return res.status(404).json({ message: "Record not found" });
  }

  // 5) Si algún handler setea err.statusCode / err.status, respétalo
  const status = err.statusCode || err.status || 500;

  // 6) Mensaje genérico (evitar exponer detalles en prod)
  const message = err.message || "Internal server error";

  // Log interno (en prod podrías usar un logger)
  if (process.env.NODE_ENV !== "test") {
    console.error(err);
  }

  res.status(status).json({ message });
});

export default app;

