PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'BORROWER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "id", "name", "passwordHash", "role", "updatedAt")
SELECT "createdAt", "email", "id", "name", "passwordHash", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

DROP TABLE IF EXISTS "Repayment";
DROP TABLE IF EXISTS "FinancingRequest";
DROP TABLE IF EXISTS "PoolDeposit";

CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerWalletAddress" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceAmount" REAL NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "contractInvoiceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Invoice_supplierId_invoiceNumber_key" ON "Invoice"("supplierId", "invoiceNumber");

CREATE TABLE "FinancingRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "grossBorrowAmount" REAL NOT NULL,
    "advanceRateBps" INTEGER NOT NULL,
    "interestRateBps" INTEGER NOT NULL,
    "interestAmount" REAL NOT NULL,
    "processingFeeBps" INTEGER NOT NULL,
    "processingFeeAmount" REAL NOT NULL,
    "expectedSettlementAmount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "contractRequestId" TEXT,
    "transactionHash" TEXT,
    "approvedById" TEXT,
    "approvedAt" DATETIME,
    "borrowedAt" DATETIME,
    "settledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinancingRequest_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FinancingRequest_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FinancingRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FinancingRequest_invoiceId_key" ON "FinancingRequest"("invoiceId");
CREATE INDEX "FinancingRequest_supplierId_status_idx" ON "FinancingRequest"("supplierId", "status");

CREATE TABLE "PoolDeposit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "investorId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceAmount" REAL NOT NULL,
    "tokenAmount" REAL NOT NULL,
    "sharesReceived" REAL NOT NULL,
    "transactionHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PoolDeposit_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PoolDeposit_investorId_createdAt_idx" ON "PoolDeposit"("investorId", "createdAt");

CREATE TABLE "InvoiceSettlement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "financingRequestId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "customerId" TEXT,
    "customerWalletAddress" TEXT NOT NULL,
    "invoiceAmount" REAL NOT NULL,
    "principalRecovered" REAL NOT NULL,
    "interestRecovered" REAL NOT NULL,
    "processingFeeRecovered" REAL NOT NULL,
    "supplierSurplus" REAL NOT NULL,
    "transactionHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoiceSettlement_financingRequestId_fkey" FOREIGN KEY ("financingRequestId") REFERENCES "FinancingRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvoiceSettlement_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvoiceSettlement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InvoiceSettlement_financingRequestId_key" ON "InvoiceSettlement"("financingRequestId");
CREATE UNIQUE INDEX "InvoiceSettlement_invoiceId_key" ON "InvoiceSettlement"("invoiceId");

CREATE TABLE "PlatformFee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "financingRequestId" TEXT NOT NULL,
    "feeAmount" REAL NOT NULL,
    "treasuryWalletAddress" TEXT NOT NULL,
    "transactionHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformFee_financingRequestId_fkey" FOREIGN KEY ("financingRequestId") REFERENCES "FinancingRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PlatformFee_financingRequestId_key" ON "PlatformFee"("financingRequestId");

CREATE TABLE "PoolTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "userId" TEXT,
    "walletAddress" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "sharesAmount" REAL,
    "transactionHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PoolTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "PoolTransaction_type_createdAt_idx" ON "PoolTransaction"("type", "createdAt");
CREATE INDEX "PoolTransaction_userId_createdAt_idx" ON "PoolTransaction"("userId", "createdAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
