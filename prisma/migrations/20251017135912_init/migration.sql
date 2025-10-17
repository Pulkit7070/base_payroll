-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "bulk_payroll_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uploaderId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "totalRows" INTEGER NOT NULL,
    "validRows" INTEGER NOT NULL,
    "invalidRows" INTEGER NOT NULL,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "rawPayload" TEXT NOT NULL,
    "errorSummary" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "bulk_payroll_jobs_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bulk_payroll_rows" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "input" TEXT NOT NULL,
    "normalized" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "providerResponse" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "bulk_payroll_rows_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "bulk_payroll_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "bulk_payroll_jobs_uploaderId_idx" ON "bulk_payroll_jobs"("uploaderId");

-- CreateIndex
CREATE INDEX "bulk_payroll_jobs_status_idx" ON "bulk_payroll_jobs"("status");

-- CreateIndex
CREATE INDEX "bulk_payroll_jobs_createdAt_idx" ON "bulk_payroll_jobs"("createdAt");

-- CreateIndex
CREATE INDEX "bulk_payroll_rows_jobId_idx" ON "bulk_payroll_rows"("jobId");

-- CreateIndex
CREATE INDEX "bulk_payroll_rows_status_idx" ON "bulk_payroll_rows"("status");

-- CreateIndex
CREATE UNIQUE INDEX "bulk_payroll_rows_jobId_rowIndex_key" ON "bulk_payroll_rows"("jobId", "rowIndex");
