-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "mainGoalMetric" TEXT,
ADD COLUMN     "mainGoalPeriod" TEXT,
ADD COLUMN     "mainGoalTarget" DOUBLE PRECISION,
ADD COLUMN     "mainGoalType" TEXT;
