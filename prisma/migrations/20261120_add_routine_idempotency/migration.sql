
-- Agregar identificadores opcionales de creación.
ALTER TABLE "Routine"
    ADD COLUMN "clientRequestId" TEXT,
    ADD COLUMN "clientRequestHash" TEXT;

-- Impedir repetir una misma solicitud para un usuario.
CREATE UNIQUE INDEX "Routine_userId_clientRequestId_key"
ON "Routine"("userId", "clientRequestId");
