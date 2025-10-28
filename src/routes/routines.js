// src/routes/routines.js
import express from "express";
import { verifyToken } from "../middlewares/auth.js";
import prisma from "../config/prismaClient.js";

const router = express.Router();

// Todas las rutas abajo requieren JWT
router.use(verifyToken);

// GET /api/routines  -> lista SOLO las del usuario autenticado
router.get("/", async (req, res, next) => {
  try {
    const routines = await prisma.routine.findMany({
      where: { userId: req.user.id },
      include: { exercises: true }, // quítalo si querés solo la rutina
      orderBy: { createdAt: "desc" }
    });
    res.json({ items: routines });
  } catch (err) { next(err); }
});

// POST /api/routines  -> crea rutina del usuario autenticado
router.post("/", async (req, res, next) => {
  try {
    const { title, notes, exercises } = req.body || {};

    // Validaciones mínimas
    if (!title || typeof title !== "string") {
      return res.status(400).json({ message: "title is required (string)" });
    }
    if (exercises !== undefined && !Array.isArray(exercises)) {
      return res.status(400).json({ message: "exercises must be an array if provided" });
    }

    // Sanitizar exercises (opcional)
    let createExercises;
    if (Array.isArray(exercises) && exercises.length > 0) {
      createExercises = {
        create: exercises.map((ex) => ({
          name: ex?.name,
          sets: ex?.sets ?? null,
          reps: ex?.reps ?? null,
          notes: ex?.notes ?? null,
        })).filter(e => e.name && typeof e.name === "string")
      };
      if (createExercises.create.length === 0) createExercises = undefined;
    }

    const created = await prisma.routine.create({
      data: {
        title,
        notes: notes ?? null,
        userId: req.user.id,      // <- NUNCA desde el body
        exercises: createExercises
      },
      include: { exercises: true }
    });

    res.status(201).json(created);
  } catch (err) {
    // Si tenés @@unique([userId, title]) en el modelo:
    if (err?.code === "P2002") {
      return res.status(409).json({ message: "routine title already exists for this user" });
    }
    next(err);
  }
});

export default router;
