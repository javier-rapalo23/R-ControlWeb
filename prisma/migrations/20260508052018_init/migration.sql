-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "precioPorLibra" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyBalance" (
    "id" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "saldoInicial" DECIMAL(12,2) NOT NULL,
    "saldoActual" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "materialId" TEXT NOT NULL,
    "materialNombre" TEXT NOT NULL,
    "precioPorLibra" DECIMAL(10,2) NOT NULL,
    "libras" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "categoria" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncEvent" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Material_nombre_key" ON "Material"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "DailyBalance_businessDate_key" ON "DailyBalance"("businessDate");

-- CreateIndex
CREATE INDEX "Purchase_businessDate_idx" ON "Purchase"("businessDate");

-- CreateIndex
CREATE INDEX "Sale_businessDate_idx" ON "Sale"("businessDate");

-- CreateIndex
CREATE INDEX "Expense_businessDate_idx" ON "Expense"("businessDate");

-- CreateIndex
CREATE INDEX "SyncEvent_entity_entityId_idx" ON "SyncEvent"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
