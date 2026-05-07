-- CreateTable
CREATE TABLE "RunSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "distanceMeters" DOUBLE PRECISION NOT NULL,
    "avgPaceSecPerKm" DOUBLE PRECISION,
    "maxSpeedMps" DOUBLE PRECISION,
    "pathGeoJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RunSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RunSession_userId_createdAt_idx" ON "RunSession"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "RunSession" ADD CONSTRAINT "RunSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
