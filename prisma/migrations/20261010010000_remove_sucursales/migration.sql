-- Por ahora el negocio opera con una sola sucursal: se elimina el modelo y sus referencias.

-- DropForeignKey
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_sucursalId_fkey";

-- DropForeignKey
ALTER TABLE "EmployeeAdvance" DROP CONSTRAINT "EmployeeAdvance_sucursalId_fkey";

-- DropForeignKey
ALTER TABLE "EmployeePayment" DROP CONSTRAINT "EmployeePayment_sucursalId_fkey";

-- DropIndex
DROP INDEX "Employee_sucursalId_idx";

-- AlterTable
ALTER TABLE "Employee" DROP COLUMN "sucursalId";

-- AlterTable
ALTER TABLE "EmployeeAdvance" DROP COLUMN "sucursalId";

-- AlterTable
ALTER TABLE "EmployeePayment" DROP COLUMN "sucursalId";

-- DropTable
DROP TABLE "Sucursal";

