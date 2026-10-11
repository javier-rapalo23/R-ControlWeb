-- CreateTable
CREATE TABLE "CashMovement" (
    "id" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "tipo" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashMovement_businessDate_idx" ON "CashMovement"("businessDate");

-- Reglas que Prisma no puede expresar en el schema
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_tipo_check" CHECK ("tipo" IN ('ingreso', 'salida'));
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_monto_check" CHECK ("monto" > 0);
