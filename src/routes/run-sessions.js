import { Router } from 'express';
import prisma from '../config/prisma.js';
import { verifyToken } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { createRunSessionSchema } from '../schemas/runSessionSchemas.js';

const router = Router();

router.post(
  '/',
  verifyToken,
  validate(createRunSessionSchema, 'body'),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const {
        startedAt,
        endedAt,
        durationSeconds,
        distanceMeters,
        avgPaceSecPerKm,
        maxSpeedMps,
        pathGeoJson,
      } = req.body;

      const session = await prisma.runSession.create({
        data: {
          userId,
          startedAt: new Date(startedAt),
          endedAt: new Date(endedAt),
          durationSeconds,
          distanceMeters,
          avgPaceSecPerKm: avgPaceSecPerKm ?? null,
          maxSpeedMps: maxSpeedMps ?? null,
          pathGeoJson: pathGeoJson ?? null,
        },
      });

      return res.status(201).json({
        message: 'Sesión de running guardada correctamente.',
        item: session,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/me', verifyToken, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const sessions = await prisma.runSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return res.json({ items: sessions });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', verifyToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const sessionId = req.params.id;

    const session = await prisma.runSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!session) {
      return res.status(404).json({
        message: 'Sesión no encontrada.',
      });
    }

    await prisma.runSession.delete({
      where: {
        id: sessionId,
      },
    });

    return res.json({
      message: 'Sesión eliminada correctamente.',
    });
  } catch (error) {
    next(error);
  }
});

export default router;