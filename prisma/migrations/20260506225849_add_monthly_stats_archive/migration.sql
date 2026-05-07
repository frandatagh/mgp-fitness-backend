-- CreateTable
CREATE TABLE "MonthlyStatsArchive" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "runSessions" INTEGER NOT NULL DEFAULT 0,
    "runningDistanceMeters" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "runningDurationSeconds" INTEGER NOT NULL DEFAULT 0,
    "avgRunRating" DOUBLE PRECISION,
    "avgRoutineRating" DOUBLE PRECISION,
    "avgExerciseEffort" DOUBLE PRECISION,
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyStatsArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MonthlyStatsArchive_userId_year_month_idx" ON "MonthlyStatsArchive"("userId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyStatsArchive_userId_year_month_key" ON "MonthlyStatsArchive"("userId", "year", "month");

-- AddForeignKey
ALTER TABLE "MonthlyStatsArchive" ADD CONSTRAINT "MonthlyStatsArchive_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
