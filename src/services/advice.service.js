// src/services/advice.service.js

const ADVICE_BANK = {
  avoidMaxIntensity: {
    id: 'avoid-max-intensity',
    title: 'No salgas siempre a máxima intensidad',
    description:
      'Si tus sesiones recientes tienen valoraciones muy altas, alterná con salidas más suaves. Correr fuerte todos los días puede generar fatiga acumulada.',
    type: 'running',
    priority: 90,
  },

  watchPace: {
    id: 'watch-pace',
    title: 'Cuidá el ritmo más que la velocidad',
    description:
      'El ritmo indica cuánto tardás en recorrer un kilómetro. Si tu ritmo empeora varios días seguidos, puede ser señal de cansancio, mala recuperación o exceso de carga.',
    type: 'running',
    priority: 85,
  },

  gradualProgress: {
    id: 'gradual-progress',
    title: 'Progresá de manera gradual',
    description:
      'Si aumentaste mucho la distancia semanal o mensual, mantené unos días de adaptación antes de volver a subir la carga. El progreso seguro suele ser progresivo.',
    type: 'running',
    priority: 82,
  },

  softRuns: {
    id: 'soft-runs',
    title: 'Usá las salidas suaves como parte del progreso',
    description:
      'No todas las corridas tienen que ser intensas. Las sesiones suaves ayudan a sumar volumen, mejorar base aeróbica y recuperarte mejor.',
    type: 'running',
    priority: 75,
  },

  techniqueFirst: {
    id: 'technique-first',
    title: 'Priorizá técnica sobre cantidad',
    description:
      'Si el esfuerzo sube mucho, cuidá que la técnica no se deteriore. Es preferible hacer menos repeticiones bien ejecutadas que muchas con mala postura.',
    type: 'training',
    priority: 88,
  },

  rethinkRoutine: {
    id: 'rethink-routine',
    title: 'Replanteá la rutina si bajás varios días seguidos',
    description:
      'Si tenés varios registros recientes con bajo rendimiento, revisá la rutina. Tal vez necesites reducir volumen, cambiar ejercicios o mejorar descanso.',
    type: 'recovery',
    priority: 100,
  },

  rateExercises: {
    id: 'rate-exercises',
    title: 'Valorá también los ejercicios individuales',
    description:
      'Si no valorás la rutina completa, valorar ejercicios ayuda a calcular un promedio real del entrenamiento y detectar cuáles te resultan más exigentes.',
    type: 'habit',
    priority: 70,
  },

  restIsTraining: {
    id: 'rest-is-training',
    title: 'Descansar también es entrenar',
    description:
      'El progreso no ocurre solo durante la actividad. Dormir bien y permitir recuperación es parte fundamental del rendimiento.',
    type: 'recovery',
    priority: 92,
  },

  fatigueWarning: {
    id: 'fatigue-warning',
    title: 'Prestá atención a la fatiga acumulada',
    description:
      'Si bajan tus marcas y sube tu esfuerzo, probablemente el cuerpo esté pidiendo recuperación. No siempre la solución es entrenar más.',
    type: 'recovery',
    priority: 95,
  },

  registerMore: {
    id: 'register-more',
    title: 'Registrá para entenderte mejor',
    description:
      'Cuantos más datos reales cargues, mejores serán las lecturas de la app. Registrar distancia, esfuerzo, rutinas y sensaciones permite consejos más precisos.',
    type: 'habit',
    priority: 60,
  },
};

function uniqueAdvice(items) {
  const map = new Map();

  items.forEach((item) => {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  });

  return Array.from(map.values());
}

function areBothLow(values) {
  return values.length >= 2 && values.slice(0, 2).every((value) => value <= 5);
}

function areBothHigh(values) {
  return values.length >= 2 && values.slice(0, 2).every((value) => value >= 8);
}

function normalizeRunSession(session) {
  if (session.rating == null) return null;

  return {
    id: session.id,
    type: 'running',
    date: session.startedAt || session.createdAt,
    rating: Number(session.rating),
    avgPaceSecPerKm: session.avgPaceSecPerKm ?? null,
    distanceMeters: Number(session.distanceMeters || 0),
  };
}

function normalizeRoutineCheckin(checkin) {
  if (checkin.score == null) return null;

  return {
    id: checkin.id,
    type: 'routine',
    date: checkin.trackedDate || checkin.createdAt,
    rating: Number(checkin.score),
  };
}

function normalizeExerciseCheckin(checkin) {
  if (checkin.score == null) return null;

  return {
    id: checkin.id,
    type: 'exercise',
    date: checkin.trackedDate || checkin.createdAt,
    rating: Number(checkin.score),
  };
}

export async function buildUserAdvice(prisma, userId) {
  const advice = [];

  const [
  runSessions,
  routineCheckins,
  exerciseCheckins,
] = await Promise.all([
  prisma.runSession.findMany({
    where: { userId },
    orderBy: { startedAt: 'desc' },
    take: 10,
  }),

  prisma.routineCheckin.findMany({
    where: { userId },
    orderBy: { trackedDate: 'desc' },
    take: 10,
  }),

  prisma.exerciseCheckin.findMany({
    where: { userId },
    orderBy: { trackedDate: 'desc' },
    take: 20,
  }),
]);

  const normalizedRuns = runSessions
    .map(normalizeRunSession)
    .filter(Boolean);

  const normalizedRoutines = routineCheckins
    .map(normalizeRoutineCheckin)
    .filter(Boolean);

  const normalizedExercises = exerciseCheckins
    .map(normalizeExerciseCheckin)
    .filter(Boolean);

  const recentRatedRecords = [
    ...normalizedRuns,
    ...normalizedRoutines,
    ...normalizedExercises,
  ]
    .filter((record) => Number.isFinite(record.rating))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const lastTwoRatings = recentRatedRecords
    .slice(0, 2)
    .map((record) => record.rating);

  const lastTwoRuns = recentRatedRecords
    .filter((record) => record.type === 'running')
    .slice(0, 2);

  const lastTwoRunRatings = lastTwoRuns.map((record) => record.rating);

  const lastTwoTraining = recentRatedRecords
    .filter((record) => record.type === 'routine' || record.type === 'exercise')
    .slice(0, 2);

  const lastTwoTrainingRatings = lastTwoTraining.map((record) => record.rating);

  if (recentRatedRecords.length < 2) {
    advice.push(ADVICE_BANK.registerMore);
  }

  if (areBothLow(lastTwoRatings)) {
    advice.push(ADVICE_BANK.rethinkRoutine);
    advice.push(ADVICE_BANK.restIsTraining);
    advice.push(ADVICE_BANK.fatigueWarning);
  }

  if (areBothHigh(lastTwoRatings)) {
    advice.push(ADVICE_BANK.fatigueWarning);
    advice.push(ADVICE_BANK.restIsTraining);
  }

  if (areBothHigh(lastTwoRunRatings)) {
    advice.push(ADVICE_BANK.avoidMaxIntensity);
    advice.push(ADVICE_BANK.softRuns);
  }

  if (lastTwoRuns.length >= 2) {
    const latest = lastTwoRuns[0];
    const previous = lastTwoRuns[1];

    if (
      latest.avgPaceSecPerKm &&
      previous.avgPaceSecPerKm &&
      latest.avgPaceSecPerKm > previous.avgPaceSecPerKm * 1.08
    ) {
      advice.push(ADVICE_BANK.watchPace);
    }
  }

  if (lastTwoRuns.length >= 2) {
    const latest = lastTwoRuns[0];
    const previous = lastTwoRuns[1];

    if (
      latest.distanceMeters &&
      previous.distanceMeters &&
      latest.distanceMeters > previous.distanceMeters * 1.35
    ) {
      advice.push(ADVICE_BANK.gradualProgress);
    }
  }

  if (areBothLow(lastTwoTrainingRatings)) {
    advice.push(ADVICE_BANK.rethinkRoutine);
    advice.push(ADVICE_BANK.restIsTraining);
  }

  if (areBothHigh(lastTwoTrainingRatings)) {
    advice.push(ADVICE_BANK.techniqueFirst);
    advice.push(ADVICE_BANK.restIsTraining);
  }

  // Por ahora no podemos detectar ejercicios sin valoración,
// porque el modelo exerciseCheckin requiere score obligatorio.
// Esta regla se puede implementar más adelante desde otro dato.

  if (advice.length === 0) {
    advice.push(ADVICE_BANK.softRuns);
    advice.push(ADVICE_BANK.restIsTraining);
    advice.push(ADVICE_BANK.registerMore);
  }

  return uniqueAdvice(advice)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3);
}