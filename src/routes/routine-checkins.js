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

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const checkin = await prisma.routineCheckin.findFirst({
      where: {
        id,
        userId: req.user.id,
      },
    });

    if (!checkin) {
      return res.status(404).json({ message: 'Registro no encontrado' });
    }

    await prisma.routineCheckin.delete({
      where: { id },
    });

    return res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    console.error('Error borrando valoración de rutina:', error);
    return res.status(500).json({ message: 'Error interno al borrar registro' });
  }
});

export default router;