// src/routes/routines.js
import express from "express";
import prisma from "../config/prismaClient.js";
import { verifyToken } from "../middlewares/auth.js";

import { validate } from "../middlewares/validate.js";
import {
  routineCreateSchema,
  routineUpdateSchema,
  routineImportJsonSchema,
  routineImportLimitSchema,
  // si tenés un schema para params, descomenta e importa:
  // routineIdParamsSchema,
} from "../schemas/routineSchemas.js";

import { routineToCsv, csvToRoutine } from "../utils/csv.js";
import exercisesRouter from "./exercises.js";

import { validate } from "../middlewares/validate.js";
import { routineCreateSchema, routineUpdateSchema } from "../schemas/routineSchemas.js";

const router = express.Router();

// Todas las rutas de routines requieren JWT
router.use(verifyToken);

// Subrouter de ejercicios anidado
router.use("/:routineId/exercises", exercisesRouter);

// GET /api/routines -> lista SOLO las del usuario autenticado
router.get("/", async (req, res, next) => {
  try {
    const routines = await prisma.routine.findMany({
      where: { userId: req.user.id },
      include: { exercises: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ items: routines });
  } catch (err) { next(err); }
});

// POST /api/routines -> crea rutina del usuario autenticado
router.post("/", validate(routineCreateSchema), async (req, res, next) => {
  try {
    const { title, notes, exercises } = req.body;

    const created = await prisma.routine.create({
      data: {
        title,
        notes: notes ?? null,
        userId: req.user.id,
        exercises: Array.isArray(exercises) && exercises.length
          ? {
              create: exercises
                .map((ex, idx) => ({
                  name: ex?.name,
                  sets: ex?.sets ?? null,
                  reps: ex?.reps ?? null,
                  notes: ex?.notes ?? null,
                  order: ex?.order ?? idx,
                }))
                .filter(e => e.name && typeof e.name === "string"),
            }
          : undefined,
      },
      include: { exercises: true },
    });

    res.status(201).json(created);
  } catch (err) {
    if (err?.code === "P2002") {
      return res.status(409).json({ message: "routine title already exists for this user" });
    }
    next(err);
  }
});

// GET /api/routines/:id -> detalle de una rutina propia
router.get(
  "/:id",
  // validate(routineIdParamsSchema, "params"),
  async (req, res, next) => {
    try {
      const routine = await prisma.routine.findFirst({
        where: { id: req.params.id, userId: req.user.id },
        include: { exercises: true },
      });
      if (!routine) return res.status(404).json({ message: "Routine not found" });
      res.json(routine);
    } catch (err) { next(err); }
  }
);

// PUT /api/routines/:id -> actualizar título/notas de una rutina propia
router.put(
  "/:id",
  // validate(routineIdParamsSchema, "params"),
  validate(routineUpdateSchema, "body"),
  async (req, res, next) => {
    try {
      const existing = await prisma.routine.findFirst({
        where: { id: req.params.id, userId: req.user.id },
      });
      if (!existing) return res.status(404).json({ message: "Routine not found" });

      const { title, notes } = req.body;
      const updated = await prisma.routine.update({
        where: { id: existing.id },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(notes !== undefined ? { notes: notes ?? null } : {}),
        },
      });
      res.json(updated);
    } catch (err) { next(err); }
  }
);

// DELETE /api/routines/:id -> borrar una rutina propia
router.delete(
  "/:id",
  // validate(routineIdParamsSchema, "params"),
  async (req, res, next) => {
    try {
      const existing = await prisma.routine.findFirst({
        where: { id: req.params.id, userId: req.user.id },
      });
      if (!existing) return res.status(404).json({ message: "Routine not found" });

      await prisma.routine.delete({ where: { id: existing.id } });
      res.status(204).send();
    } catch (err) { next(err); }
  }
);

// --- EXPORT JSON ---
router.get("/:id/export.json", async (req, res, next) => {
  try {
    const routine = await prisma.routine.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { exercises: true },
    });
    if (!routine) return res.status(404).json({ message: "Routine not found" });

    const payload = {
      title: routine.title,
      notes: routine.notes ?? undefined,
      exercises: routine.exercises.map(ex => ({
        name: ex.name,
        sets: ex.sets ?? undefined,
        reps: ex.reps ?? undefined,
        notes: ex.notes ?? undefined,
        order: ex.order ?? 0,
      })),
    };

    res
      .status(200)
      .set("Content-Type", "application/json")
      .set("Content-Disposition", `attachment; filename="routine-${routine.id}.json"`)
      .json(payload);
  } catch (err) { next(err); }
});

// --- EXPORT CSV ---
router.get("/:id/export.csv", async (req, res, next) => {
  try {
    const routine = await prisma.routine.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { exercises: true },
    });
    if (!routine) return res.status(404).json({ message: "Routine not found" });

    const csv = routineToCsv(routine);
    res
      .status(200)
      .set("Content-Type", "text/csv; charset=utf-8")
      .set("Content-Disposition", `attachment; filename="routine-${routine.id}.csv"`)
      .send(csv);
  } catch (err) { next(err); }
});

// --- IMPORT JSON ---
router.post("/import/json", validate(routineImportJsonSchema), async (req, res, next) => {
  try {
    const parsed = routineImportLimitSchema.safeParse(req.body);
    if (!parsed.success) {
      const err = new Error("Validation failed");
      err.statusCode = 400;
      err.details = parsed.error.issues.map(i => ({ path: i.path.join("."), message: i.message }));
      return next(err);
    }
    const data = parsed.data;

    const created = await prisma.routine.create({
      data: {
        title: data.title,
        notes: data.notes ?? null,
        userId: req.user.id,
        exercises: data.exercises?.length
          ? { create: data.exercises.map((ex, idx) => ({
              name: ex.name, sets: ex.sets ?? null, reps: ex.reps ?? null,
              notes: ex.notes ?? null, order: ex.order ?? idx
            })) }
          : undefined
      },
      include: { exercises: true }
    });

    res.status(201).json(created);
  } catch (err) { next(err); }
});

// --- IMPORT CSV ---
router.post("/import/csv", async (req, res, next) => {
  try {
    const obj = csvToRoutine(req.body); // req.body es string
    const parsed = routineImportLimitSchema.safeParse(obj);
    if (!parsed.success) {
      const err = new Error("Validation failed");
      err.statusCode = 400;
      err.details = parsed.error.issues.map(i => ({ path: i.path.join("."), message: i.message }));
      return next(err);
    }
    const data = parsed.data;

    const created = await prisma.routine.create({
      data: {
        title: data.title,
        notes: data.notes ?? null,
        userId: req.user.id,
        exercises: data.exercises?.length
          ? { create: data.exercises.map((ex, idx) => ({
              name: ex.name, sets: ex.sets ?? null, reps: ex.reps ?? null,
              notes: ex.notes ?? null, order: ex.order ?? idx
            })) }
          : undefined
      },
      include: { exercises: true }
    });

    res.status(201).json(created);
  } catch (err) { next(err); }
});

export default router;
