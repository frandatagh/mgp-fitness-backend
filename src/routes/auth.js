// src/routes/auth.js
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../config/prismaClient.js";

import { validate } from "../middlewares/validate.js";
import { sendWelcomeEmail } from '../services/emailService.js';
import { registerSchema, loginSchema } from "../schemas/authSchemas.js";

import crypto from 'crypto';
import { forgotPasswordSchema, resetPasswordSchema } from '../schemas/authSchemas.js';
import { sendPasswordResetEmail } from '../services/emailService.js';

const router = express.Router();


function ensureJwtSecret() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    const err = new Error("Server misconfigured: JWT_SECRET missing or too short");
    err.statusCode = 500;
    throw err;
  }
}
function signJwt(userId) {
  ensureJwtSecret();
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}
function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}
function normalizePassword(password) {
  return (password || "").trim();
}
function isValidEmail(email) {
  // Validación simple; para producción considera 'validator' o Zod
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// POST /api/auth/register
router.post("/register", async (req, res, next) => {
  try {
    let { email, password, name } = req.body || {};
    email = normalizeEmail(email);
    password = normalizePassword(password);

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    // Pre-chequeo para feedback rápido
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hash = await bcrypt.hash(password, 10);

    // Usa select para no exponer password accidentalmente
    const user = await prisma.user.create({
      data: { email, password: hash, name: name ?? null, profile: {
      create: {},
    }, },
      select: { id: true, email: true, name: true }
    });
    if (user.email) {
      try {
        await sendWelcomeEmail({
          to: user.email,
          name: user.name,
      });
      } catch (mailError) {
        console.error('Error enviando email de bienvenida:', mailError);
      }
    }

    const token = signJwt(user.id);
    return res.status(201).json({ token, user });
  } catch (err) {
    // Manejo de condición de carrera (unique constraint)
    if (err?.code === "P2002" && err?.meta?.target?.includes("email")) {
      return res.status(409).json({ message: "Email already registered" });
    }
    return next(err);
  }
});

// POST /api/auth/login
router.post("/login", async (req, res, next) => {
  try {
    let { email, password } = req.body || {};
    email = normalizeEmail(email);
    password = normalizePassword(password);

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      // Aquí sí necesitamos password para comparar, así que no usamos select
    });

    // Respuesta neutra para no filtrar existencia de email
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signJwt(user.id);
    return res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    return next(err);
  }
});

router.post(
  '/forgot-password',
  validate(forgotPasswordSchema),
  async (req, res, next) => {
    try {
      const { email } = req.body;

      const user = await prisma.user.findUnique({
        where: { email },
      });

      // respuesta genérica para no revelar si el correo existe
      const safeResponse = {
        message:
          'Si el correo ingresado pertenece a una cuenta registrada, recibirás un mensaje con los pasos para restablecer tu contraseña.',
      };

      if (!user) {
        return res.status(200).json(safeResponse);
      }

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hora

      await prisma.passwordResetToken.create({
        data: {
          tokenHash,
          expiresAt,
          userId: user.id,
        },
      });
      const appBaseUrl = (process.env.APP_BASE_URL || 'http://localhost:8081').trim();

      console.log('APP_BASE_URL raw:', process.env.APP_BASE_URL);
      console.log('APP_BASE_URL final:', appBaseUrl);

      const resetUrl = `${appBaseUrl}/reset-password?token=${rawToken}`;
      console.log('resetUrl:', resetUrl);
      
      try {
        await sendPasswordResetEmail({
          to: user.email,
          resetUrl,
        });
      } catch (mailError) {
        console.error('Error enviando email de recuperación:', mailError);
      }

      return res.status(200).json(safeResponse);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/reset-password',
  validate(resetPasswordSchema),
  async (req, res, next) => {
    try {
      const { token, password } = req.body;

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      const resetRecord = await prisma.passwordResetToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (
        !resetRecord ||
        resetRecord.usedAt ||
        resetRecord.expiresAt.getTime() < Date.now()
      ) {
        return res.status(400).json({
          message: 'El enlace de recuperación es inválido o ha expirado.',
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      await prisma.$transaction([
        prisma.user.update({
          where: { id: resetRecord.userId },
          data: { password: passwordHash },
        }),
        prisma.passwordResetToken.update({
          where: { id: resetRecord.id },
          data: { usedAt: new Date() },
        }),
      ]);

      return res.status(200).json({
        message: 'La contraseña fue restablecida correctamente.',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
