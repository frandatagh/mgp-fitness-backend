import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../middlewares/auth.js';
import { archiveMonthForUser } from '../services/archiveMonthlyStats.js';

const router = Router();
const prisma = new PrismaClient();

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatPace(secPerKm) {
  if (!secPerKm) return '--';

  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);

  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatDateLabel(date) {
  const d = new Date(date);

  return d.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  });
}

function dateKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [
      runSessions,
      routineCheckins,
      exerciseCheckins,
    ] = await Promise.all([
      prisma.runSession.findMany({
        where: { userId },
        orderBy: { startedAt: 'desc' },
      }),

      prisma.routineCheckin.findMany({
        where: { userId },
        include: {
          routine: true,
        },
        orderBy: { createdAt: 'desc' },
      }),

      prisma.exerciseCheckin.findMany({
        where: { userId },
        include: {
          exercise: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const records = [];

    // RUNNING
    for (const run of runSessions) {
      records.push({
        id: run.id,
        type: 'run',
        title: 'Sesión running',
        subtitle:
          `Distancia: ${(run.distanceMeters / 1000).toFixed(2)} km · ` +
          `Tiempo: ${formatDuration(run.durationSeconds)} · ` +
          `Ritmo: ${formatPace(run.avgPaceSecPerKm)}/km`,
        rating: run.rating,
        createdAt: run.startedAt,
      });
    }

    // RUTINAS
    for (const routine of routineCheckins) {
      records.push({
        id: routine.id,
        type: 'routine',
        title: routine.routine?.title || 'Rutina',
        subtitle: `Valoración general: ${routine.score}/10`,
        rating: routine.score,
        createdAt: routine.createdAt,
      });
    }

    // EJERCICIOS
    for (const exercise of exerciseCheckins) {
      records.push({
        id: exercise.id,
        type: 'exercise',
        title: exercise.exercise?.name || 'Ejercicio',
        subtitle: `Esfuerzo registrado: ${exercise.score}/10`,
        rating: exercise.score,
        createdAt: exercise.createdAt,
      });
    }

    // ordenar DESC
    records.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
    );

    // agrupar por fecha
    const grouped = {};

    for (const record of records) {
      const key = dateKey(record.createdAt);

      if (!grouped[key]) {
        grouped[key] = {
          date: key,
          label: formatDateLabel(record.createdAt),
          records: [],
        };
      }

      grouped[key].records.push(record);
    }

    const monthlyArchives = await prisma.monthlyStatsArchive.findMany({
  where: { userId },
  orderBy: [
    { year: 'desc' },
    { month: 'desc' },
  ],
});

const monthNames = [
  '',
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const archivedItems = monthlyArchives.map((archive) => {
  const distanceKm = archive.runningDistanceMeters
    ? (archive.runningDistanceMeters / 1000).toFixed(2)
    : '0.00';

  const h = Math.floor(archive.runningDurationSeconds / 3600);
  const m = Math.floor((archive.runningDurationSeconds % 3600) / 60);
  const s = archive.runningDurationSeconds % 60;

  const durationText = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  const effortValues = [
    archive.avgRunRating,
    archive.avgRoutineRating,
    archive.avgExerciseEffort,
  ].filter((v) => v != null);

  const avgEffort =
    effortValues.length > 0
      ? effortValues.reduce((a, b) => Number(a) + Number(b), 0) / effortValues.length
      : null;

  return {
    id: archive.id,
    year: archive.year,
    month: archive.month,
    label: `${monthNames[archive.month]} ${archive.year}`,
    subtitle:
      `${archive.runSessions} sesiones · ${distanceKm} km · ${durationText}` +
      (avgEffort != null ? ` · esfuerzo promedio ${avgEffort.toFixed(1)}/10` : ''),
    runSessions: archive.runSessions,
    runningDistanceMeters: archive.runningDistanceMeters,
    runningDurationSeconds: archive.runningDurationSeconds,
    avgRunRating: archive.avgRunRating,
    avgRoutineRating: archive.avgRoutineRating,
    avgExerciseEffort: archive.avgExerciseEffort,
  };
});

    return res.json({
      items: Object.values(grouped),
    archivedItems,
    });
  } catch (error) {
    console.error('Error obteniendo historial:', error);

    return res.status(500).json({
      message: 'Error interno obteniendo historial',
    });
  }
});

router.post('/archive-old', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);

    const oldRuns = await prisma.runSession.findMany({
      where: {
        userId,
        startedAt: { lt: cutoff },
      },
      select: {
        startedAt: true,
      },
    });

    const oldRoutineCheckins = await prisma.routineCheckin.findMany({
      where: {
        userId,
        createdAt: { lt: cutoff },
      },
      select: {
        createdAt: true,
      },
    });

    const oldExerciseCheckins = await prisma.exerciseCheckin.findMany({
      where: {
        userId,
        createdAt: { lt: cutoff },
      },
      select: {
        createdAt: true,
      },
    });

    const monthKeys = new Set();

    for (const item of oldRuns) {
      const d = new Date(item.startedAt);
      monthKeys.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
    }

    for (const item of oldRoutineCheckins) {
      const d = new Date(item.createdAt);
      monthKeys.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
    }

    for (const item of oldExerciseCheckins) {
      const d = new Date(item.createdAt);
      monthKeys.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
    }

    const archives = [];

    for (const key of monthKeys) {
      const [year, month] = key.split('-').map(Number);
      const archive = await archiveMonthForUser(prisma, userId, year, month);
      archives.push(archive);
    }

    await prisma.runSession.updateMany({
      where: {
        userId,
        startedAt: { lt: cutoff },
      },
      data: {
        pathGeoJson: null,
      },
    });

    await prisma.exerciseCheckin.deleteMany({
      where: {
        userId,
        createdAt: { lt: cutoff },
      },
    });

    await prisma.routineCheckin.deleteMany({
      where: {
        userId,
        createdAt: { lt: cutoff },
      },
    });

    return res.json({
      message: 'Historial antiguo archivado correctamente',
      archivedMonths: archives.length,
      items: archives,
    });
  } catch (error) {
    console.error('Error archivando historial antiguo:', error);
    return res.status(500).json({
      message: 'Error interno archivando historial antiguo',
    });
  }
});

router.delete('/clear-all', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    await prisma.$transaction([
      prisma.runSession.deleteMany({
        where: { userId },
      }),
      prisma.routineCheckin.deleteMany({
        where: { userId },
      }),
      prisma.exerciseCheckin.deleteMany({
        where: { userId },
      }),
      prisma.monthlyStatsArchive.deleteMany({
        where: { userId },
      }),
    ]);

    return res.json({
      message: 'Historial eliminado correctamente',
    });
  } catch (error) {
    console.error('Error limpiando historial:', error);
    return res.status(500).json({
      message: 'Error interno limpiando historial',
    });
  }
});

export default router;