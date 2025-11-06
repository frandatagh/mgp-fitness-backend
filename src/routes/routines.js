// src/routes/routines.js
import express from "express";
import { verifyToken } from "../middlewares/auth.js";
import prisma from "../config/prismaClient.js";

import { validate } from "../middlewares/validate.js";
import { routineCreateSchema, routineUpdateSchema } from "../schemas/routineSchemas.js";

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

// GET /api/routines/:id  -> detalle de una rutina propia
router.get("/:id", async (req, res, next) => {
  try {
    const routine = await prisma.routine.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { exercises: true }
    });
    if (!routine) return res.status(404).json({ message: "Routine not found" });
    res.json(routine);
  } catch (err) { next(err); }
});

// PUT /api/routines/:id  -> actualizar título/notas de una rutina propia
router.put("/:id", async (req, res, next) => {
  try {
    const existing = await prisma.routine.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });
    if (!existing) return res.status(404).json({ message: "Routine not found" });

    const { title, notes } = req.body || {};
    const data = {};
    if (title !== undefined) {
      if (!title || typeof title !== "string") {
        return res.status(400).json({ message: "title must be a non-empty string" });
      }
      data.title = title;
    }
    if (notes !== undefined) data.notes = notes ?? null;

    const updated = await prisma.routine.update({ where: { id: existing.id }, data });
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/routines/:id  -> borrar una rutina propia
router.delete("/:id", async (req, res, next) => {
  try {
    const existing = await prisma.routine.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });
    if (!existing) return res.status(404).json({ message: "Routine not found" });

    await prisma.routine.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (err) { next(err); }
});


export default router;

import exercisesRouter from "./exercises.js";
router.use("/:routineId/exercises", exercisesRouter);
