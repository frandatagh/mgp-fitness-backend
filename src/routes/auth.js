// src/routes/auth.js
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../config/prismaClient.js";

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
      data: { email, password: hash, name: name ?? null },
      select: { id: true, email: true, name: true }
    });

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

export default router;
