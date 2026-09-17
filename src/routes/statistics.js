import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../middlewares/auth.js';
import { buildUserAdvice } from '../services/advice.service.js';

const router = Router();
const prisma = new PrismaClient();

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function startOfMonth(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function safeAvg(values) {
  const valid = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function avgPaceSecPerKmFromSessions(sessions) {
  const totalDistance = sessions.reduce((sum, s) => sum + Number(s.distanceMeters || 0), 0);
  const totalDuration = sessions.reduce((sum, s) => sum + Number(s.durationSeconds || 0), 0);
  if (totalDistance <= 0 || totalDuration <= 0) return null;
  return totalDuration / (totalDistance / 1000);
}

function dayNameEs(dateOrDateKey) {
  const names = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return names[new Date(dateOrDateKey).getDay()];
}

function avgByExercise(checkins) {
  const map = new Map();

  for (const c of checkins) {
    const name = c.exercise?.name || 'Ejercicio';
    if (!map.has(c.exerciseId)) {
      map.set(c.exerciseId, {
        exerciseId: c.exerciseId,
        exerciseName: name,
        values: [],
      });
    }

    map.get(c.exerciseId).values.push(Number(c.score));
  }

  return Array.from(map.values())
    .map((item) => ({
      exerciseId: item.exerciseId,
      exerciseName: item.exerciseName,
      avgEffort: safeAvg(item.values),
      count: item.values.length,
    }))
    .filter((item) => item.avgEffort != null);
}

function buildRoutineRatingStats(routineCheckins) {
  const weeklyAverage = safeAvg(routineCheckins.map((c) => Number(c.score)));

  const byDay = new Map();

  for (const c of routineCheckins) {
    const day = dayNameEs(c.trackedDate);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(Number(c.score));
  }

  const rows = Array.from(byDay.entries())
    .map(([day, values]) => ({
      day,
      avg: safeAvg(values),
    }))
    .filter((x) => x.avg != null);

  if (!rows.length) {
    return {
      weeklyAverage,
      bestDay: null,
      worstDay: null,
    };
  }

  rows.sort((a, b) => b.avg - a.avg);

  return {
    weeklyAverage,
    bestDay: rows[0]?.day ?? null,
    worstDay: rows[rows.length - 1]?.day ?? null,
  };
}

function buildRunningRatingStats(runSessions) {
  const weeklyAverage = safeAvg(
    runSessions
      .map((s) => s.rating)
      .filter((v) => v != null)
      .map(Number)
  );

  const byDay = new Map();

  for (const s of runSessions) {
    if (s.rating == null) continue;

    const day = dayNameEs(s.startedAt);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(Number(s.rating));
  }

  const rows = Array.from(byDay.entries())
    .map(([day, values]) => ({
      day,
      avg: safeAvg(values),
    }))
    .filter((x) => x.avg != null);

  if (!rows.length) {
    return {
      weeklyAverage,
      bestDay: null,
      worstDay: null,
    };
  }

  rows.sort((a, b) => b.avg - a.avg);

  return {
    weeklyAverage,
    bestDay: rows[0]?.day ?? null,
    worstDay: rows[rows.length - 1]?.day ?? null,
  };
}

function buildInsights({
  weeklyRunSessions,
  weeklyRoutineCheckins,
  weeklyExerciseAvg,
  weeklyPace,
  previousWeeklyPace,
  combinedRatingAvg,
}) {
  const insights = [];

  if (weeklyPace && previousWeeklyPace && weeklyPace < previousWeeklyPace) {
    insights.push({
      id: 'running-pace-improved',
      title: 'Mejoraste tu ritmo en running',
      description: 'Tu ritmo promedio semanal mejoró respecto a la semana anterior.',
      type: 'positive',
    });
  }

  if (weeklyRunSessions.length + weeklyRoutineCheckins.length >= 3) {
    insights.push({
      id: 'good-consistency',
      title: 'Entrenaste con buena consistencia',
      description: 'Esta semana registraste varias sesiones de entrenamiento.',
      type: 'positive',
    });
  }

  if (weeklyExerciseAvg != null && weeklyExerciseAvg >= 8.5) {
    insights.push({
      id: 'high-gym-effort',
      title: 'Semana fuerte en gimnasio',
      description: 'Tus ejercicios muestran un esfuerzo alto. Cuida la recuperación.',
      type: 'warning',
    });
  }

  if (combinedRatingAvg != null && combinedRatingAvg >= 8) {
    insights.push({
      id: 'high-performance-week',
      title: 'Buena valoración semanal',
      description: 'Tus registros muestran una semana con buen rendimiento general.',
      type: 'positive',
    });
  }

  if (!insights.length) {
    insights.push({
      id: 'keep-recording',
      title: 'Sigue registrando tus entrenamientos',
      description: 'Cuantos más datos guardes, mejores estadísticas vas a recibir.',
      type: 'neutral',
    });
  }

  return insights;
}

router.get('/me', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const now = new Date();
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);

    const previousWeekStart = new Date(weekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);

    const previousWeekEnd = new Date(weekStart);

    const weekStartKey = toDateKey(weekStart);
    const monthStartKey = toDateKey(monthStart);
    const previousWeekStartKey = toDateKey(previousWeekStart);
    const previousWeekEndKey = toDateKey(previousWeekEnd);

    const [
      allRunSessions,
      weeklyRunSessions,
      monthlyRunSessions,
      previousWeeklyRunSessions,
      weeklyExerciseCheckins,
      monthlyExerciseCheckins,
      weeklyRoutineCheckins,
      monthlyRoutineCheckins,
      latestRoutineCheckin,
    ] = await Promise.all([
      prisma.runSession.findMany({
        where: { userId },
        orderBy: { startedAt: 'desc' },
      }),

      prisma.runSession.findMany({
        where: {
          userId,
          startedAt: { gte: weekStart },
        },
        orderBy: { startedAt: 'asc' },
      }),

      prisma.runSession.findMany({
        where: {
          userId,
          startedAt: { gte: monthStart },
        },
        orderBy: { startedAt: 'asc' },
      }),

      prisma.runSession.findMany({
        where: {
          userId,
          startedAt: {
            gte: previousWeekStart,
            lt: previousWeekEnd,
          },
        },
      }),

      prisma.exerciseCheckin.findMany({
        where: {
          userId,
          trackedDate: { gte: weekStartKey },
        },
        include: { exercise: true },
        orderBy: { trackedDate: 'asc' },
      }),

      prisma.exerciseCheckin.findMany({
        where: {
          userId,
          trackedDate: { gte: monthStartKey },
        },
        include: { exercise: true },
        orderBy: { trackedDate: 'asc' },
      }),

      prisma.routineCheckin.findMany({
        where: {
          userId,
          trackedDate: { gte: weekStartKey },
        },
        orderBy: { trackedDate: 'asc' },
      }),

      prisma.routineCheckin.findMany({
        where: {
          userId,
          trackedDate: { gte: monthStartKey },
        },
        orderBy: { trackedDate: 'asc' },
      }),

      prisma.routineCheckin.findFirst({
  where: {
    userId,
  },

  orderBy: [
    {
      trackedDate: 'desc',
    },
    {
      updatedAt: 'desc',
    },
  ],

  select: {
    score: true,
    trackedDate: true,
    updatedAt: true,
  },
}),
    ]);

    const weeklyDistanceMeters = weeklyRunSessions.reduce(
      (sum, s) => sum + Number(s.distanceMeters || 0),
      0
    );

    const monthlyDistanceMeters = monthlyRunSessions.reduce(
      (sum, s) => sum + Number(s.distanceMeters || 0),
      0
    );

    const totalDistanceMeters = allRunSessions.reduce(
      (sum, s) => sum + Number(s.distanceMeters || 0),
      0
    );

    const weeklyDurationSeconds = weeklyRunSessions.reduce(
      (sum, s) => sum + Number(s.durationSeconds || 0),
      0
    );

    const monthlyDurationSeconds = monthlyRunSessions.reduce(
      (sum, s) => sum + Number(s.durationSeconds || 0),
      0
    );

    const weeklyAvgPaceSecPerKm = avgPaceSecPerKmFromSessions(weeklyRunSessions);
    const monthlyAvgPaceSecPerKm = avgPaceSecPerKmFromSessions(monthlyRunSessions);
    const previousWeeklyAvgPaceSecPerKm =
      avgPaceSecPerKmFromSessions(previousWeeklyRunSessions);

    const avgMaxSpeedMps = safeAvg(
      monthlyRunSessions
        .map((s) => s.maxSpeedMps)
        .filter((v) => v != null)
        .map(Number)
    );

    const exerciseRows = avgByExercise(monthlyExerciseCheckins);

    const avgEffortByExercise = [...exerciseRows].sort(
      (a, b) => b.avgEffort - a.avgEffort
    );

    const topHardestExercises = [...exerciseRows]
      .sort((a, b) => b.avgEffort - a.avgEffort)
      .slice(0, 5);

    const topBestExercises = [...exerciseRows]
      .sort((a, b) => a.avgEffort - b.avgEffort)
      .slice(0, 5);

    const weeklyExerciseAvg = safeAvg(
      weeklyExerciseCheckins.map((c) => Number(c.score))
    );

    const routineRatingStats = buildRoutineRatingStats(weeklyRoutineCheckins);
    const runningRatingStats = buildRunningRatingStats(weeklyRunSessions);

    const combinedRatingAvg = safeAvg([
      ...(weeklyRoutineCheckins.map((c) => Number(c.score))),
      ...(weeklyRunSessions
        .map((s) => s.rating)
        .filter((v) => v != null)
        .map(Number)),
    ]);

    const monthlyCombinedRatingAvg =
  safeAvg([
    ...monthlyRoutineCheckins.map(
      (checkin) =>
        Number(checkin.score)
    ),

    ...monthlyRunSessions
      .map(
        (session) =>
          session.rating
      )
      .filter(
        (rating) =>
          rating != null
      )
      .map(Number),
  ]);

  const latestRatedRunSession =
  allRunSessions.find(
    (session) =>
      session.rating != null
  ) ?? null;


/*
 * Armamos candidatos:
 *
 * - última valoración de rutina
 * - última valoración de running
 */
const latestRatingCandidates = [];


if (latestRoutineCheckin) {
  latestRatingCandidates.push({
    value: Number(
      latestRoutineCheckin.score
    ),

    date: new Date(
      latestRoutineCheckin.updatedAt ??
      latestRoutineCheckin.trackedDate
    ).getTime(),
  });
}


if (latestRatedRunSession) {
  latestRatingCandidates.push({
    value: Number(
      latestRatedRunSession.rating
    ),

    date: new Date(
      latestRatedRunSession.startedAt
    ).getTime(),
  });
}


/*
 * Eliminamos cualquier valor inválido.
 */
const validLatestRatingCandidates =
  latestRatingCandidates.filter(
    (item) =>
      Number.isFinite(item.value) &&
      Number.isFinite(item.date)
  );


/*
 * Ordenamos de más reciente
 * a más antiguo.
 */
validLatestRatingCandidates.sort(
  (a, b) =>
    b.date - a.date
);


/*
 * El primero es la última
 * valoración real registrada.
 */
const latestAverage =
  validLatestRatingCandidates[0]
    ?.value ??
  null;

    const chartLabels = ['1', '2', '3', '4', '5', '6'];

    const gymChart = weeklyRoutineCheckins
      .slice(-6)
      .map((c) => Number(c.score));

    const runningChart = weeklyRunSessions
      .filter((s) => s.rating != null)
      .slice(-6)
      .map((s) => Number(s.rating));

    const insights = buildInsights({
      weeklyRunSessions,
      weeklyRoutineCheckins,
      weeklyExerciseAvg,
      weeklyPace: weeklyAvgPaceSecPerKm,
      previousWeeklyPace: previousWeeklyAvgPaceSecPerKm,
      combinedRatingAvg,
    });

    return res.json({
      summary: {
        weeklySessions: weeklyRunSessions.length + weeklyRoutineCheckins.length,
        totalDistanceMeters,
        avgEffort: weeklyExerciseAvg ?? combinedRatingAvg,
      },

      insights,

      performance: {
  /*
   * Semana actual
   */
  weeklyAverage:
    combinedRatingAvg,

  /*
   * Mes actual
   */
  monthlyAverage:
    monthlyCombinedRatingAvg,

  /*
   * Última valoración histórica
   */
  latestAverage,

  bestDay:
    routineRatingStats.bestDay ??
    runningRatingStats.bestDay,

  worstDay:
    routineRatingStats.worstDay ??
    runningRatingStats.worstDay,

  chart: {
    labels: chartLabels,
    gym: gymChart,
    running: runningChart,
  },
},

      running: {
        weeklyDurationSeconds,
        monthlyDurationSeconds,
        avgMaxSpeedMps,
        weeklyAvgPaceSecPerKm,
        monthlyAvgPaceSecPerKm,
        weeklyDistanceMeters,
        monthlyDistanceMeters,
      },

      effort: {
        avgEffortByExercise,
        topBestExercises,
        topHardestExercises,
      },
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    return res.status(500).json({
      message: 'Error interno obteniendo estadísticas',
    });
  }
});

router.get('/advice', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const items = await buildUserAdvice(prisma, userId);

    return res.json({ items });
  } catch (error) {
    console.error('Error obteniendo consejos:', error);

    return res.status(500).json({
      message: 'Error interno obteniendo consejos',
    });
  }
});

/*
 * =====================================================
 * ACTIVIDAD / CONSTANCIA HISTÓRICA
 * =====================================================
 */

router.get('/activity', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();

    /*
     * Sólo pedimos los campos necesarios.
     * No cargamos rutinas completas ni ejercicios completos.
     */
    const [
      routineCheckins,
      exerciseCheckins,
      runSessions,
    ] = await Promise.all([
      prisma.routineCheckin.findMany({
        where: {
          userId,
        },

        select: {
          trackedDate: true,
        },

        orderBy: {
          trackedDate: 'asc',
        },
      }),

      prisma.exerciseCheckin.findMany({
        where: {
          userId,
        },

        select: {
          trackedDate: true,
        },

        orderBy: {
          trackedDate: 'asc',
        },
      }),

      prisma.runSession.findMany({
        where: {
          userId,
        },

        select: {
          startedAt: true,
        },

        orderBy: {
          startedAt: 'asc',
        },
      }),
    ]);


    /*
     * =================================================
     * MAPA DIARIO
     * =================================================
     */

    const activityByDate = new Map();


    const getOrCreateDay = (dateKey) => {
      if (!activityByDate.has(dateKey)) {
        activityByDate.set(dateKey, {
          date: dateKey,

          routineRecords: 0,

          exerciseRecords: 0,

          runningSessions: 0,

          totalRecords: 0,
        });
      }

      return activityByDate.get(dateKey);
    };


    for (const item of routineCheckins) {
      const dateKey =
        String(item.trackedDate)
          .slice(0, 10);

      const day =
        getOrCreateDay(dateKey);

      day.routineRecords += 1;
      day.totalRecords += 1;
    }


    for (const item of exerciseCheckins) {
      const dateKey =
        String(item.trackedDate)
          .slice(0, 10);

      const day =
        getOrCreateDay(dateKey);

      day.exerciseRecords += 1;
      day.totalRecords += 1;
    }


    for (const session of runSessions) {
      const dateKey =
        toDateKey(
          new Date(
            session.startedAt
          )
        );

      const day =
        getOrCreateDay(dateKey);

      day.runningSessions += 1;
      day.totalRecords += 1;
    }


    /*
     * =================================================
     * HELPERS DE FECHA
     * =================================================
     */

    const addDays = (
      date,
      amount
    ) => {
      const result =
        new Date(date);

      result.setDate(
        result.getDate() +
        amount
      );

      return result;
    };


    const buildDaysBetween = (
      start,
      end
    ) => {
      const result = [];

      let cursor =
        startOfDay(start);

      const finalDate =
        startOfDay(end);

      while (
        cursor <= finalDate
      ) {
        const dateKey =
          toDateKey(cursor);

        const existing =
          activityByDate.get(
            dateKey
          );

        result.push({
          date: dateKey,

          routineRecords:
            existing
              ?.routineRecords ??
            0,

          exerciseRecords:
            existing
              ?.exerciseRecords ??
            0,

          runningSessions:
            existing
              ?.runningSessions ??
            0,

          totalRecords:
            existing
              ?.totalRecords ??
            0,

          active:
            (
              existing
                ?.totalRecords ??
              0
            ) > 0,
        });

        cursor =
          addDays(
            cursor,
            1
          );
      }

      return result;
    };


    /*
     * =================================================
     * SEMANA ACTUAL
     * =================================================
     */

    const currentWeekStart =
      startOfWeek(now);

    const currentWeekEnd =
      addDays(
        currentWeekStart,
        6
      );

    const currentWeek =
      buildDaysBetween(
        currentWeekStart,
        currentWeekEnd
      );


    /*
     * =================================================
     * MES ACTUAL
     * =================================================
     */

    const currentMonthStart =
      startOfMonth(now);

    const currentMonthEnd =
      new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
      );

    const currentMonth =
      buildDaysBetween(
        currentMonthStart,
        currentMonthEnd
      );


    /*
     * =================================================
     * HISTORIAL SEMANAL
     * =================================================
     */

    const registeredDates =
      Array.from(
        activityByDate.keys()
      ).sort();


    const firstRegisteredDate =
      registeredDates[0] ??
      toDateKey(now);


    /*
     * Usamos mediodía para evitar problemas
     * al interpretar YYYY-MM-DD.
     */
    const firstDate =
      new Date(
        `${firstRegisteredDate}T12:00:00`
      );

    let historyCursor =
      startOfWeek(
        firstDate
      );

    const currentHistoryWeek =
      startOfWeek(now);

    const weeklyHistory = [];


    while (
      historyCursor <=
      currentHistoryWeek
    ) {
      const weekEnd =
        addDays(
          historyCursor,
          6
        );

      const days =
        buildDaysBetween(
          historyCursor,
          weekEnd
        );

      const activeDays =
        days.filter(
          (day) =>
            day.active
        ).length;

      const routineRecords =
        days.reduce(
          (sum, day) =>
            sum +
            day.routineRecords,
          0
        );

      const exerciseRecords =
        days.reduce(
          (sum, day) =>
            sum +
            day.exerciseRecords,
          0
        );

      const runningSessions =
        days.reduce(
          (sum, day) =>
            sum +
            day.runningSessions,
          0
        );

      const totalRecords =
        routineRecords +
        exerciseRecords +
        runningSessions;


      /*
       * Índice visual de constancia.
       *
       * 7 días activos = 10.
       * 0 días activos = 0.
       *
       * Los registros individuales se muestran
       * como detalle, pero no inflan artificialmente
       * el índice.
       */
      const consistencyScore =
        Number(
          (
            activeDays /
            7 *
            10
          ).toFixed(1)
        );


      weeklyHistory.push({
        weekStart:
          toDateKey(
            historyCursor
          ),

        weekEnd:
          toDateKey(
            weekEnd
          ),

        activeDays,

        routineRecords,

        exerciseRecords,

        runningSessions,

        totalRecords,

        consistencyScore,
      });


      historyCursor =
        addDays(
          historyCursor,
          7
        );
    }


    /*
     * =================================================
     * TOTALES
     * =================================================
     */

    const allDays =
      Array.from(
        activityByDate.values()
      );

    const totalActiveDays =
      allDays.filter(
        (day) =>
          day.totalRecords >
          0
      ).length;


    return res.json({
      currentWeek,

      currentMonth,

      weeklyHistory,

      totals: {
        activeDays:
          totalActiveDays,

        routineRecords:
          routineCheckins.length,

        exerciseRecords:
          exerciseCheckins.length,

        runningSessions:
          runSessions.length,

        totalRecords:
          routineCheckins.length +
          exerciseCheckins.length +
          runSessions.length,
      },
    });

  } catch (error) {
    console.error(
      'Error obteniendo actividad:',
      error
    );

    return res.status(500).json({
      message:
        'Error interno obteniendo actividad',
    });
  }
});

export default router;