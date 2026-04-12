import { Router } from 'express';
import prisma from '../config/prisma.js';
import { verifyToken } from '../middlewares/auth.js';
import { z } from 'zod';
import { validate } from '../middlewares/validate.js';

const router = Router();

const exerciseCheckinBodySchema = z.object({
  routineId: z.string().min(1),
  score: z.number().int().min(1).max(10),
});

const exerciseIdParamsSchema = z.object({
  id: z.string().min(1),
});

router.post(
  '/:id/checkin',
  verifyToken,
  validate(exerciseIdParamsSchema, 'params'),
  validate(exerciseCheckinBodySchema, 'body'),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const exerciseId = req.params.id;
      const { routineId, score } = req.body;

      const exercise = await prisma.exercise.findFirst({
        where: {
          id: exerciseId,
          routineId,
          routine: {
            userId,
          },
        },
      });

      if (!exercise) {
        return res.status(404).json({
          message: 'Ejercicio no encontrado o no pertenece al usuario.',
        });
      }

      const trackedDate = new Date().toISOString().slice(0, 10);

const checkin = await prisma.exerciseCheckin.upsert({
  where: {
    userId_exerciseId_trackedDate: {
      userId,
      exerciseId,
      trackedDate,
    },
  },
  update: {
    routineId,
    score,
  },
  create: {
    userId,
    routineId,
    exerciseId,
    score,
    trackedDate,
  },
});

      return res.status(200).json({
        message: 'Ejercicio registrado correctamente.',
        item: checkin,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;