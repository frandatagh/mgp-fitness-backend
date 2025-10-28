-- DropForeignKey
ALTER TABLE "public"."Exercise" DROP CONSTRAINT "Exercise_routineId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Routine" DROP CONSTRAINT "Routine_userId_fkey";

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Exercise_routineId_idx" ON "Exercise"("routineId");

-- CreateIndex
CREATE INDEX "Exercise_routineId_order_idx" ON "Exercise"("routineId", "order");

-- CreateIndex
CREATE INDEX "Routine_userId_idx" ON "Routine"("userId");

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
