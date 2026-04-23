import { Router } from 'express';
import prisma from '../config/prisma.js';
import { verifyToken } from '../middlewares/auth.js';
import { z } from 'zod';
import { validate } from '../middlewares/validate.js';

const router = Router();

const routineCheckinBodySchema = z.object({
  score: z.number().int().min(1).max(10),
});

const routineIdParamsSchema = z.object({
  id: z.string().min(1),
});

router.post(
  '/:id/checkin',
  verifyToken,
  validate(routineIdParamsSchema, 'params'),
  validate(routineCheckinBodySchema, 'body'),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const routineId = req.params.id;
      const { score } = req.body;

      const routine = await prisma.routine.findFirst({
        where: {
          id: routineId,
          userId,
        },
      });

      if (!routine) {
        return res.status(404).json({
          message: 'Rutina no encontrada o no pertenece al usuario.',
        });
      }

      const trackedDate = new Date().toISOString().slice(0, 10);

      const checkin = await prisma.routineCheckin.upsert({
        where: {
          userId_routineId_trackedDate: {
            userId,
            routineId,
            trackedDate,
          },
        },
        update: {
          score,
        },
        create: {
          userId,
          routineId,
          score,
          trackedDate,
        },
      });

      return res.status(200).json({
        message: 'Rutina registrada correctamente.',
        item: checkin,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;