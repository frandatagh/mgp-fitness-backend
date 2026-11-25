
-- Guardar la fecha real de realización de las rutinas.
-- Las valoraciones existentes conservarán sus datos.
ALTER TABLE "RoutineCheckin"
ADD COLUMN "performedAt" TIMESTAMP(3);

-- Guardar la fecha real de realización de los ejercicios.
-- Las valoraciones existentes conservarán sus datos.
ALTER TABLE "ExerciseCheckin"
ADD COLUMN "performedAt" TIMESTAMP(3);
