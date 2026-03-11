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
  routineIdParamsSchema,
  // si tenés un schema para params, descomenta e importa:
  // routineIdParamsSchema,
} from "../schemas/routineSchemas.js";

import { routineToCsv, csvToRoutine } from "../utils/csv.js";
import exercisesRouter from "./exercises.js";






const router = express.Router();

// Todas las rutas de routines requieren JWT
router.use(verifyToken);

// Subrouter de ejercicios anidado
router.use("/:routineId/exercises", exercisesRouter);

// 👉 RUTINAS SUGERIDAS (LISTA)
router.get("/suggestions", verifyToken, async (req, res) => {
  try {
    const suggestionsUser = await prisma.user.findUnique({
      where: { email: SUGGESTIONS_EMAIL },
    });

    if (!suggestionsUser) {
      return res
        .status(500)
        .json({ error: "Usuario de sugerencias no configurado" });
    }

    const routines = await prisma.routine.findMany({
      where: { userId: suggestionsUser.id },
      include: { exercises: true },
      orderBy: { createdAt: "desc" },
    });

    res.json({ items: routines });
  } catch (err) {
    console.error("Error cargando sugerencias:", err);
    res.status(500).json({ error: "Error al cargar rutinas sugeridas" });
  }
});

// 👉 RUTINA SUGERIDA (DETALLE)
router.get("/suggestions/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const suggestionsUser = await prisma.user.findUnique({
      where: { email: SUGGESTIONS_EMAIL },
    });

    if (!suggestionsUser) {
      return res
        .status(500)
        .json({ error: "Usuario de sugerencias no configurado" });
    }

    const routine = await prisma.routine.findFirst({
      where: { id, userId: suggestionsUser.id },
      include: { exercises: true },
    });

    if (!routine) {
      return res.status(404).json({ error: "Rutina sugerida no encontrada" });
    }

    res.json(routine);
  } catch (err) {
    console.error("Error detalle sugerencia:", err);
    res.status(500).json({ error: "Error al cargar la rutina sugerida" });
  }
});

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
                  day: ex?.day ?? null, 
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
  validate(routineIdParamsSchema, "params"),
  async (req, res, next) => {
    try {
      console.log("🔍 GET /api/routines/:id");
      console.log("  id param:", req.params.id);
      console.log("  user from token:", req.user?.id);

      const routine = await prisma.routine.findFirst({
        where: { id: req.params.id, userId: req.user.id },
        include: { exercises: true },
      });

      console.log("  routine found?", !!routine);

      if (!routine) {
        return res.status(404).json({ message: "Routine not found" });
      }

      res.json(routine);
    } catch (err) {
      console.error("❌ Error en GET /api/routines/:id:", err);
      next(err);
    }
  }
);


// PUT /api/routines/:id -> actualizar título/notas de una rutina propia
router.put(
  "/:id",
  verifyToken,                                     // 👈 aseguramos que haya req.user.id
  validate(routineIdParamsSchema, "params"),
  validate(routineUpdateSchema, "body"),
  async (req, res, next) => {
    try {
      const routineId = req.params.id;
      const userId = req.user.id;
      const { title, notes, exercises } = req.body;

      // 1) Verificar que la rutina exista y sea del usuario
      const existing = await prisma.routine.findFirst({
        where: { id: routineId, userId },
      });

      if (!existing) {
        return res.status(404).json({ message: "Routine not found" });
      }

      // 2) Usamos una transacción para actualizar rutina + ejercicios
      const updatedRoutine = await prisma.$transaction(async (tx) => {
        // 2.a) actualizar título / notas
        await tx.routine.update({
          where: { id: routineId },
          data: {
            ...(title !== undefined ? { title } : {}),
            ...(notes !== undefined ? { notes: notes ?? null } : {}),
          },
        });

        // 2.b) si el body trae exercises, reseteamos la lista
        if (Array.isArray(exercises)) {
          // borrar los ejercicios anteriores de esta rutina
          await tx.exercise.deleteMany({
            where: { routineId },
          });

          // crear los nuevos (si hay)
          if (exercises.length > 0) {
            await tx.exercise.createMany({
              data: exercises.map((ex, index) => ({
                name: ex.name,
                sets: ex.sets ?? null,
                reps: ex.reps ?? null,
                notes: ex.notes ?? null,
                day: ex.day ?? null,
                order:
                  typeof ex.order === "number"
                    ? ex.order
                    : index,          // fallback si no mandás order
                routineId,
              })),
            });
          }
        }

        // 2.c) devolver la rutina ya con ejercicios actualizados
        return tx.routine.findUnique({
          where: { id: routineId },
          include: {
            exercises: {
              orderBy: { order: "asc" },
            },
          },
        });
      });

      res.json(updatedRoutine);
    } catch (err) {
      next(err);
    }
  }
);


// DELETE /api/routines/:id -> borrar una rutina propia
router.delete(
  "/:id",
  validate(routineIdParamsSchema, "params"),
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

// Marcar rutina como "realizada por hoy"
router.patch(
  '/:id/done',
  verifyToken,
  validate(routineIdParamsSchema, 'params'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const routine = await prisma.routine.update({
        where: { id },                // 👈 si usas userId en el where, luego lo ajustamos
        data: {
          lastDoneAt: new Date(),     // campo nuevo en la tabla
        },
        include: {
          exercises: true,            // igual que en tu GET, si lo usas
        },
      });

      return res.json(routine);
    } catch (error) {
      console.error('Error marcando rutina como realizada:', error);
      return res
        .status(500)
        .json({ message: 'No se pudo marcar la rutina como realizada.' });
    }
  }
);
const SUGGESTIONS_EMAIL = "sugerencias@prueba.com";





export default router;
