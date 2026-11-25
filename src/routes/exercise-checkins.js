import { Router } from 'express';
import prisma from '../config/prisma.js';
import { verifyToken } from '../middlewares/auth.js';
import { z } from 'zod';
import { validate } from '../middlewares/validate.js';

const router = Router();


const exerciseCheckinBodySchema = z.object({
  routineId: z.string().min(1),
  score: z.number().int().min(1).max(10),
  performedAt: z.string().datetime({ offset: true }).optional(),
});


const exerciseIdParamsSchema = z.object({
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
  validate(exerciseIdParamsSchema, 'params'),
  validate(exerciseCheckinBodySchema, 'body'),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const exerciseId = req.params.id;
      const { routineId, score, performedAt } = req.body;

      const now = new Date();

      const performedDate = performedAt
        ? new Date(performedAt)
        : now;

      // Evitamos fechas futuras incorrectas.
      if (performedDate.getTime() > now.getTime() + 5 * 60 * 1000) {
        return res.status(400).json({
          message: 'La fecha de realización no puede estar en el futuro.',
        });
      }


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

      const trackedDate = getArgentinaDateKey(performedDate);

      const checkin = await prisma.$transaction(async (tx) => {

        // 1. Crear el registro únicamente si todavía
        // no existe una valoración del ejercicio para ese día.
        await tx.exerciseCheckin.createMany({
          data: [{
            userId,
            routineId,
            exerciseId,
            score,
            trackedDate,
            performedAt: performedDate,
          }],
          skipDuplicates: true,
        });

        // 2. Actualizar solamente si la nueva valoración
        // fue realizada después de la que está guardada.
        await tx.exerciseCheckin.updateMany({
          where: {
            userId,
            exerciseId,
            trackedDate,
            OR: [
              { performedAt: null },
              { performedAt: { lt: performedDate } },
            ],
          },
          data: {
            routineId,
            score,
            performedAt: performedDate,
          },
        });

        // 3. Recuperar la valoración definitiva.
        const savedCheckin = await tx.exerciseCheckin.findUnique({
          where: {
            userId_exerciseId_trackedDate: {
              userId,
              exerciseId,
              trackedDate,
            },
          },
        });

        return savedCheckin;
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

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const checkin = await prisma.exerciseCheckin.findFirst({
      where: {
        id,
        userId: req.user.id,
      },
    });

    if (!checkin) {
      return res.status(404).json({ message: 'Registro no encontrado' });
    }

    await prisma.exerciseCheckin.delete({
      where: { id },
    });

    return res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    console.error('Error borrando valoración de ejercicio:', error);
    return res.status(500).json({ message: 'Error interno al borrar registro' });
  }
});

export default router;