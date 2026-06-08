PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerWalletAddress" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceAmount" REAL NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "contractInvoiceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Invoice" (
    "id",
    "supplierId",
    "customerId",
    "customerName",
    "customerWalletAddress",
    "invoiceNumber",
    "invoiceAmount",
    "dueDate",
    "status",
    "contractInvoiceId",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "supplierId",
    NULL,
    "customerName",
    "customerWalletAddress",
    "invoiceNumber",
    "invoiceAmount",
    "dueDate",
    "status",
    "contractInvoiceId",
    "createdAt",
    "updatedAt"
FROM "Invoice";

DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_supplierId_invoiceNumber_key" ON "Invoice"("supplierId", "invoiceNumber");
CREATE INDEX "Invoice_customerId_status_idx" ON "Invoice"("customerId", "status");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
