BEGIN;

CREATE TABLE "PurchaseDraft" (
    "id" TEXT NOT NULL,
    "ownerEmail" VARCHAR(255) NOT NULL,
    "createdByEmail" VARCHAR(255) NOT NULL,
    "updatedByEmail" VARCHAR(255) NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PurchaseDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseTransaction" (
    "id" TEXT NOT NULL,
    "reference" VARCHAR(40) NOT NULL,
    "recordedByEmail" VARCHAR(255) NOT NULL,
    "recordedByName" VARCHAR(120) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidedByEmail" VARCHAR(255),
    "voidReason" TEXT,
    CONSTRAINT "PurchaseTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseSheet" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "inventoryCategoryId" TEXT NOT NULL,
    "inventoryCategoryCodeSnapshot" VARCHAR(40) NOT NULL,
    "inventoryCategoryNameSnapshot" VARCHAR(100) NOT NULL,
    "purchaseDate" DATE NOT NULL,
    "supplierName" VARCHAR(160) NOT NULL,
    "invoiceNumber" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseSheet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseLine" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "purchaseUnitId" TEXT NOT NULL,
    "ingredientCodeSnapshot" VARCHAR(64) NOT NULL,
    "ingredientNameSnapshot" VARCHAR(160) NOT NULL,
    "purchaseUnitCodeSnapshot" VARCHAR(32) NOT NULL,
    "purchaseUnitNameSnapshot" VARCHAR(80) NOT NULL,
    "purchaseUnitSymbolSnapshot" VARCHAR(16) NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "itemAmount" DECIMAL(18,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseDailySequence" (
    "businessDate" DATE NOT NULL,
    "lastSequence" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseDailySequence_pkey" PRIMARY KEY ("businessDate")
);

CREATE UNIQUE INDEX "PurchaseDraft_ownerEmail_key" ON "PurchaseDraft"("ownerEmail");
CREATE INDEX "PurchaseDraft_updatedAt_idx" ON "PurchaseDraft"("updatedAt");

CREATE UNIQUE INDEX "PurchaseTransaction_reference_key" ON "PurchaseTransaction"("reference");
CREATE INDEX "PurchaseTransaction_createdAt_idx" ON "PurchaseTransaction"("createdAt");
CREATE INDEX "PurchaseTransaction_recordedByEmail_idx" ON "PurchaseTransaction"("recordedByEmail");
CREATE INDEX "PurchaseTransaction_voidedAt_createdAt_idx" ON "PurchaseTransaction"("voidedAt", "createdAt");
CREATE INDEX "PurchaseTransaction_totalAmount_idx" ON "PurchaseTransaction"("totalAmount");

CREATE UNIQUE INDEX "PurchaseSheet_transactionId_inventoryCategoryId_key"
    ON "PurchaseSheet"("transactionId", "inventoryCategoryId");
CREATE INDEX "PurchaseSheet_purchaseDate_idx" ON "PurchaseSheet"("purchaseDate");
CREATE INDEX "PurchaseSheet_supplierName_idx" ON "PurchaseSheet"("supplierName");
CREATE INDEX "PurchaseSheet_invoiceNumber_idx" ON "PurchaseSheet"("invoiceNumber");
CREATE INDEX "PurchaseSheet_inventoryCategoryId_purchaseDate_idx"
    ON "PurchaseSheet"("inventoryCategoryId", "purchaseDate");

CREATE INDEX "PurchaseLine_sheetId_sortOrder_idx" ON "PurchaseLine"("sheetId", "sortOrder");
CREATE INDEX "PurchaseLine_ingredientId_idx" ON "PurchaseLine"("ingredientId");
CREATE INDEX "PurchaseLine_purchaseUnitId_idx" ON "PurchaseLine"("purchaseUnitId");
CREATE INDEX "PurchaseLine_ingredientNameSnapshot_idx" ON "PurchaseLine"("ingredientNameSnapshot");

ALTER TABLE "PurchaseSheet"
    ADD CONSTRAINT "PurchaseSheet_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "PurchaseTransaction"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseSheet"
    ADD CONSTRAINT "PurchaseSheet_inventoryCategoryId_fkey"
    FOREIGN KEY ("inventoryCategoryId") REFERENCES "InventoryCategory"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseLine"
    ADD CONSTRAINT "PurchaseLine_sheetId_fkey"
    FOREIGN KEY ("sheetId") REFERENCES "PurchaseSheet"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseLine"
    ADD CONSTRAINT "PurchaseLine_ingredientId_fkey"
    FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseLine"
    ADD CONSTRAINT "PurchaseLine_purchaseUnitId_fkey"
    FOREIGN KEY ("purchaseUnitId") REFERENCES "Unit"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;