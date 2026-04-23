/*
  Warnings:

  - A unique constraint covering the columns `[userId,exerciseId,trackedDate]` on the table `ExerciseCheckin` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `trackedDate` to the `ExerciseCheckin` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ExerciseCheckin` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."ExerciseCheckin_exerciseId_createdAt_idx";

-- DropIndex
DROP INDEX "public"."ExerciseCheckin_routineId_createdAt_idx";

-- DropIndex
DROP INDEX "public"."ExerciseCheckin_userId_createdAt_idx";

-- AlterTable
ALTER TABLE "ExerciseCheckin" ADD COLUMN     "trackedDate" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "ExerciseCheckin_userId_trackedDate_idx" ON "ExerciseCheckin"("userId", "trackedDate");

-- CreateIndex
CREATE INDEX "ExerciseCheckin_exerciseId_trackedDate_idx" ON "ExerciseCheckin"("exerciseId", "trackedDate");

-- CreateIndex
CREATE INDEX "ExerciseCheckin_routineId_trackedDate_idx" ON "ExerciseCheckin"("routineId", "trackedDate");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseCheckin_userId_exerciseId_trackedDate_key" ON "ExerciseCheckin"("userId", "exerciseId", "trackedDate");
