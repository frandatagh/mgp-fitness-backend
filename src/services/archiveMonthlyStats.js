function startOfMonth(year, month) {
  return new Date(year, month - 1, 1, 0, 0, 0, 0);
}

function startOfNextMonth(year, month) {
  if (month === 12) return new Date(year + 1, 0, 1, 0, 0, 0, 0);
  return new Date(year, month, 1, 0, 0, 0, 0);
}

function dateKeyFromDate(date) {
  return date.toISOString().slice(0, 10);
}

function safeAvg(values) {
  const valid = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export async function archiveMonthForUser(prisma, userId, year, month) {
  const monthStart = startOfMonth(year, month);
  const nextMonthStart = startOfNextMonth(year, month);

  const monthStartKey = dateKeyFromDate(monthStart);
  const nextMonthStartKey = dateKeyFromDate(nextMonthStart);

  const [runSessions, routineCheckins, exerciseCheckins] = await Promise.all([
    prisma.runSession.findMany({
      where: {
        userId,
        startedAt: {
          gte: monthStart,
          lt: nextMonthStart,
        },
      },
    }),

    prisma.routineCheckin.findMany({
      where: {
        userId,
        trackedDate: {
          gte: monthStartKey,
          lt: nextMonthStartKey,
        },
      },
    }),

    prisma.exerciseCheckin.findMany({
      where: {
        userId,
        trackedDate: {
          gte: monthStartKey,
          lt: nextMonthStartKey,
        },
      },
    }),
  ]);

  const runSessionsCount = runSessions.length;

  const runningDistanceMeters = runSessions.reduce(
    (sum, s) => sum + Number(s.distanceMeters || 0),
    0
  );

  const runningDurationSeconds = runSessions.reduce(
    (sum, s) => sum + Number(s.durationSeconds || 0),
    0
  );

  const avgRunRating = safeAvg(
    runSessions
      .map((s) => s.rating)
      .filter((v) => v != null)
      .map(Number)
  );

  const avgRoutineRating = safeAvg(routineCheckins.map((c) => Number(c.score)));

  const avgExerciseEffort = safeAvg(exerciseCheckins.map((c) => Number(c.score)));

  const archive = await prisma.monthlyStatsArchive.upsert({
    where: {
      userId_year_month: {
        userId,
        year,
        month,
      },
    },
    update: {
      runSessions: runSessionsCount,
      runningDistanceMeters,
      runningDurationSeconds,
      avgRunRating,
      avgRoutineRating,
      avgExerciseEffort,
      summary: {
        archivedAt: new Date().toISOString(),
        source: 'monthly-archive',
      },
    },
    create: {
      userId,
      year,
      month,
      runSessions: runSessionsCount,
      runningDistanceMeters,
      runningDurationSeconds,
      avgRunRating,
      avgRoutineRating,
      avgExerciseEffort,
      summary: {
        archivedAt: new Date().toISOString(),
        source: 'monthly-archive',
      },
    },
  });

  return archive;
}