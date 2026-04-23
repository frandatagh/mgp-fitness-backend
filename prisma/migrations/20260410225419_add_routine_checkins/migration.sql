-- CreateTable
CREATE TABLE "RoutineCheckin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "trackedDate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutineCheckin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoutineCheckin_userId_trackedDate_idx" ON "RoutineCheckin"("userId", "trackedDate");

-- CreateIndex
CREATE INDEX "RoutineCheckin_routineId_trackedDate_idx" ON "RoutineCheckin"("routineId", "trackedDate");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineCheckin_userId_routineId_trackedDate_key" ON "RoutineCheckin"("userId", "routineId", "trackedDate");

-- AddForeignKey
ALTER TABLE "RoutineCheckin" ADD CONSTRAINT "RoutineCheckin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineCheckin" ADD CONSTRAINT "RoutineCheckin_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
