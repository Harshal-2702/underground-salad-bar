BEGIN;

CREATE TABLE "LeftoverInventoryTransaction" (
    "id" TEXT NOT NULL,
    "recordedByEmail" VARCHAR(255) NOT NULL,
    "recordedByName" VARCHAR(120) NOT NULL,
    "stocktakeDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeftoverInventoryTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeftoverInventoryLine" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "inventoryCategoryId" TEXT NOT NULL,
    "baseUnitId" TEXT NOT NULL,
    "inventoryCategoryCodeSnapshot" VARCHAR(40) NOT NULL,
    "inventoryCategoryNameSnapshot" VARCHAR(100) NOT NULL,
    "ingredientCodeSnapshot" VARCHAR(64) NOT NULL,
    "ingredientNameSnapshot" VARCHAR(160) NOT NULL,
    "baseUnitCodeSnapshot" VARCHAR(32) NOT NULL,
    "baseUnitNameSnapshot" VARCHAR(80) NOT NULL,
    "baseUnitSymbolSnapshot" VARCHAR(16) NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeftoverInventoryLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeftoverInventoryTransaction_stocktakeDate_createdAt_idx"
    ON "LeftoverInventoryTransaction"("stocktakeDate", "createdAt");
CREATE INDEX "LeftoverInventoryTransaction_recordedByEmail_idx"
    ON "LeftoverInventoryTransaction"("recordedByEmail");

CREATE UNIQUE INDEX "LeftoverInventoryLine_transactionId_ingredientId_key"
    ON "LeftoverInventoryLine"("transactionId", "ingredientId");
CREATE INDEX "LeftoverInventoryLine_transactionId_sortOrder_idx"
    ON "LeftoverInventoryLine"("transactionId", "sortOrder");
CREATE INDEX "LeftoverInventoryLine_inventoryCategoryId_transactionId_idx"
    ON "LeftoverInventoryLine"("inventoryCategoryId", "transactionId");
CREATE INDEX "LeftoverInventoryLine_ingredientId_idx"
    ON "LeftoverInventoryLine"("ingredientId");
CREATE INDEX "LeftoverInventoryLine_baseUnitId_idx"
    ON "LeftoverInventoryLine"("baseUnitId");

ALTER TABLE "LeftoverInventoryLine"
    ADD CONSTRAINT "LeftoverInventoryLine_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "LeftoverInventoryTransaction"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeftoverInventoryLine"
    ADD CONSTRAINT "LeftoverInventoryLine_ingredientId_fkey"
    FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeftoverInventoryLine"
    ADD CONSTRAINT "LeftoverInventoryLine_inventoryCategoryId_fkey"
    FOREIGN KEY ("inventoryCategoryId") REFERENCES "InventoryCategory"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeftoverInventoryLine"
    ADD CONSTRAINT "LeftoverInventoryLine_baseUnitId_fkey"
    FOREIGN KEY ("baseUnitId") REFERENCES "Unit"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
