BEGIN;

CREATE TABLE "InventoryCategory" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InventoryCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventoryCategory_code_key"
    ON "InventoryCategory"("code");

CREATE INDEX "InventoryCategory_isActive_sortOrder_idx"
    ON "InventoryCategory"("isActive", "sortOrder");

CREATE INDEX "InventoryCategory_name_idx"
    ON "InventoryCategory"("name");

INSERT INTO "InventoryCategory"
    ("id", "code", "name", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
    ('invcat_dairy', 'DAIRY', 'Dairy', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('invcat_dry', 'DRY', 'Dry', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('invcat_others', 'OTHERS', 'Others', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

ALTER TABLE "Ingredient"
    ADD COLUMN "inventoryCategoryId" TEXT;

CREATE INDEX "Ingredient_inventoryCategoryId_isActive_idx"
    ON "Ingredient"("inventoryCategoryId", "isActive");

ALTER TABLE "Ingredient"
    ADD CONSTRAINT "Ingredient_inventoryCategoryId_fkey"
    FOREIGN KEY ("inventoryCategoryId")
    REFERENCES "InventoryCategory"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMIT;