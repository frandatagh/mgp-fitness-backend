import express from "express";
import prisma from "../config/prismaClient.js";
import { verifyToken } from "../middlewares/auth.js";

import { validate } from "../middlewares/validate.js";
import { exerciseCreateSchema, exerciseUpdateSchema } from "../schemas/exerciseSchemas.js";



const router = express.Router({ mergeParams: true }); // <- clave para :routineId
router.use(verifyToken);


// helper: asegura que la rutina sea del usuario
async function getOwnedRoutine(req) {
  const { routineId } = req.params;
  return prisma.routine.findFirst({
    where: { id: routineId, userId: req.user.id }
  });
}

// POST /api/routines/:routineId/exercises
router.post("/", validate(exerciseCreateSchema), async (req, res, next) => {
  try {
    const routine = await getOwnedRoutine(req);
    if (!routine) return res.status(404).json({ message: "Routine not found" });

    const { name, sets, reps, notes, order } = req.body || {};
    if (!name || typeof name !== "string")
      return res.status(400).json({ message: "name is required (string)" });

    const ex = await prisma.exercise.create({
      data: {
        name,
        sets: sets ?? null,
        reps: reps ?? null,
        notes: notes ?? null,
        order: order ?? 0,
        routineId: routine.id
      }
    });
    res.status(201).json(ex);
  } catch (err) { next(err); }
});

// GET /api/routines/:routineId/exercises
router.get("/", async (req, res, next) => {
  try {
    const routine = await getOwnedRoutine(req);
    if (!routine) return res.status(404).json({ message: "Routine not found" });

    const items = await prisma.exercise.findMany({
      where: { routineId: routine.id },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }]
    });
    res.json({ items });
  } catch (err) { next(err); }
});

// PUT /api/routines/:routineId/exercises/:exerciseId
router.put("/:exerciseId", validate(exerciseUpdateSchema),async (req, res, next) => {
  try {
    const routine = await getOwnedRoutine(req);
    if (!routine) return res.status(404).json({ message: "Routine not found" });

    const ex = await prisma.exercise.findFirst({
      where: { id: req.params.exerciseId, routineId: routine.id }
    });
    if (!ex) return res.status(404).json({ message: "Exercise not found" });

    const { name, sets, reps, notes, order } = req.body || {};
    const data = {};
    if (name !== undefined) {
      if (!name || typeof name !== "string")
        return res.status(400).json({ message: "name must be a non-empty string" });
      data.name = name;
    }
    if (sets !== undefined) data.sets = sets ?? null;
    if (reps !== undefined) data.reps = reps ?? null;
    if (notes !== undefined) data.notes = notes ?? null;
    if (order !== undefined) data.order = order;

    const updated = await prisma.exercise.update({
      where: { id: ex.id },
      data
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/routines/:routineId/exercises/:exerciseId
router.delete("/:exerciseId", async (req, res, next) => {
  try {
    const routine = await getOwnedRoutine(req);
    if (!routine) return res.status(404).json({ message: "Routine not found" });

    const ex = await prisma.exercise.findFirst({
      where: { id: req.params.exerciseId, routineId: routine.id }
    });
    if (!ex) return res.status(404).json({ message: "Exercise not found" });

    await prisma.exercise.delete({ where: { id: ex.id } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
