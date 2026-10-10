-- CreateTable
CREATE TABLE "Sucursal" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sucursal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "puesto" TEXT,
    "telefono" TEXT,
    "salarioDiario" DECIMAL(10,2) NOT NULL,
    "fechaIngreso" DATE NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "employeeId" TEXT NOT NULL,
    "horaEntrada" TEXT NOT NULL,
    "horaSalida" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeAdvance" (
    "id" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "employeeId" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "montoAplicado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "descripcion" TEXT,
    "expenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeePayment" (
    "id" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "employeeId" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "descripcion" TEXT,
    "periodoInicio" DATE,
    "periodoFin" DATE,
    "diasTrabajados" INTEGER,
    "subtotal" DECIMAL(12,2),
    "adelantosAplicados" DECIMAL(12,2),
    "expenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAdvanceApplication" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollAdvanceApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sucursal_nombre_key" ON "Sucursal"("nombre");

-- CreateIndex
CREATE INDEX "Employee_sucursalId_idx" ON "Employee"("sucursalId");

-- CreateIndex
CREATE INDEX "Attendance_employeeId_idx" ON "Attendance"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_businessDate_employeeId_key" ON "Attendance"("businessDate", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeAdvance_expenseId_key" ON "EmployeeAdvance"("expenseId");

-- CreateIndex
CREATE INDEX "EmployeeAdvance_employeeId_idx" ON "EmployeeAdvance"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeAdvance_businessDate_idx" ON "EmployeeAdvance"("businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeePayment_expenseId_key" ON "EmployeePayment"("expenseId");

-- CreateIndex
CREATE INDEX "EmployeePayment_businessDate_idx" ON "EmployeePayment"("businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeePayment_employeeId_tipo_periodoInicio_key" ON "EmployeePayment"("employeeId", "tipo", "periodoInicio");

-- CreateIndex
CREATE INDEX "PayrollAdvanceApplication_advanceId_idx" ON "PayrollAdvanceApplication"("advanceId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollAdvanceApplication_paymentId_advanceId_key" ON "PayrollAdvanceApplication"("paymentId", "advanceId");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAdvance" ADD CONSTRAINT "EmployeeAdvance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAdvance" ADD CONSTRAINT "EmployeeAdvance_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAdvance" ADD CONSTRAINT "EmployeeAdvance_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePayment" ADD CONSTRAINT "EmployeePayment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePayment" ADD CONSTRAINT "EmployeePayment_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePayment" ADD CONSTRAINT "EmployeePayment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdvanceApplication" ADD CONSTRAINT "PayrollAdvanceApplication_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "EmployeePayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdvanceApplication" ADD CONSTRAINT "PayrollAdvanceApplication_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "EmployeeAdvance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reglas que Prisma no puede expresar en el schema
ALTER TABLE "EmployeeAdvance" ADD CONSTRAINT "EmployeeAdvance_montos_check" CHECK ("monto" > 0 AND "montoAplicado" >= 0 AND "montoAplicado" <= "monto");
ALTER TABLE "EmployeePayment" ADD CONSTRAINT "EmployeePayment_tipo_check" CHECK ("tipo" IN ('manual', 'planilla'));
ALTER TABLE "EmployeePayment" ADD CONSTRAINT "EmployeePayment_monto_check" CHECK ("monto" >= 0);
ALTER TABLE "PayrollAdvanceApplication" ADD CONSTRAINT "PayrollAdvanceApplication_monto_check" CHECK ("monto" > 0);

-- Sucursal inicial para poder dar de alta empleados
INSERT INTO "Sucursal" ("id", "nombre", "activo", "updatedAt") VALUES ('principal', 'Principal', true, CURRENT_TIMESTAMP);
