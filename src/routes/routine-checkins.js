import { Router } from 'express';
import prisma from '../config/prisma.js';
import { verifyToken } from '../middlewares/auth.js';
import { z } from 'zod';
import { validate } from '../middlewares/validate.js';

const router = Router();


const routineCheckinBodySchema = z.object({
  score: z.number().int().min(1).max(10),
  performedAt: z.string().datetime({ offset: true }).optional(),
});


const routineIdParamsSchema = z.object({
  id: z.string().min(1),
});

function getArgentinaDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

router.post(
  '/:id/checkin',
  verifyToken,
  validate(routineIdParamsSchema, 'params'),
  validate(routineCheckinBodySchema, 'body'),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const routineId = req.params.id;
      const { score, performedAt } = req.body;

      const now = new Date();

      const performedDate = performedAt
        ? new Date(performedAt)
        : now;

        // Evitamos aceptar fechas futuras incorrectas.
      if (performedDate.getTime() > now.getTime() + 5 * 60 * 1000) {
        return res.status(400).json({
        message: 'La fecha de realización no puede estar en el futuro.',
        });
      }


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

      

      const trackedDate = getArgentinaDateKey(performedDate);

      const checkin = await prisma.$transaction(async (tx) => {
        const savedCheckin = await tx.routineCheckin.upsert({
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

        // Solo actualizamos lastDoneAt si esta realización
        // es más reciente que la última registrada.
        await tx.routine.updateMany({
          where: {
            id: routineId,
            userId,
            OR: [
              { lastDoneAt: null },
              { lastDoneAt: { lt: performedDate } },
            ],
          },
          data: {
            lastDoneAt: performedDate,
          },
        });

        return savedCheckin;
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