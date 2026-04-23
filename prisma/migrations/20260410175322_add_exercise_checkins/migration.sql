-- CreateTable
CREATE TABLE "ExerciseCheckin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExerciseCheckin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExerciseCheckin_userId_createdAt_idx" ON "ExerciseCheckin"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ExerciseCheckin_exerciseId_createdAt_idx" ON "ExerciseCheckin"("exerciseId", "createdAt");

-- CreateIndex
CREATE INDEX "ExerciseCheckin_routineId_createdAt_idx" ON "ExerciseCheckin"("routineId", "createdAt");

-- AddForeignKey
ALTER TABLE "ExerciseCheckin" ADD CONSTRAINT "ExerciseCheckin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseCheckin" ADD CONSTRAINT "ExerciseCheckin_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseCheckin" ADD CONSTRAINT "ExerciseCheckin_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
