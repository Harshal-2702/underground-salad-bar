-- CreateEnum
CREATE TYPE "UnitDimension" AS ENUM ('MASS', 'VOLUME', 'COUNT', 'PORTION', 'PACKAGE');

-- CreateEnum
CREATE TYPE "AllergenPresence" AS ENUM ('CONTAINS', 'MAY_CONTAIN', 'CROSS_CONTACT_RISK');

-- CreateTable
CREATE TABLE "IngredientCategory" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngredientCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "symbol" VARCHAR(16) NOT NULL,
    "dimension" "UnitDimension" NOT NULL,
    "factorToCanonical" DECIMAL(18,9),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "sku" VARCHAR(80),
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "baseUnitId" TEXT NOT NULL,
    "defaultPurchaseUnitId" TEXT,
    "isStockTracked" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientUnitConversion" (
    "ingredientId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "quantityInBaseUnit" DECIMAL(18,6) NOT NULL,
    "isApproximate" BOOLEAN NOT NULL DEFAULT false,
    "notes" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngredientUnitConversion_pkey" PRIMARY KEY ("ingredientId","unitId")
);

-- CreateTable
CREATE TABLE "Allergen" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Allergen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientAllergen" (
    "ingredientId" TEXT NOT NULL,
    "allergenId" TEXT NOT NULL,
    "presence" "AllergenPresence" NOT NULL DEFAULT 'CONTAINS',
    "notes" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngredientAllergen_pkey" PRIMARY KEY ("ingredientId","allergenId")
);

-- CreateIndex
CREATE UNIQUE INDEX "IngredientCategory_code_key" ON "IngredientCategory"("code");

-- CreateIndex
CREATE INDEX "IngredientCategory_isActive_sortOrder_idx" ON "IngredientCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "IngredientCategory_name_idx" ON "IngredientCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_code_key" ON "Unit"("code");

-- CreateIndex
CREATE INDEX "Unit_dimension_isActive_idx" ON "Unit"("dimension", "isActive");

-- CreateIndex
CREATE INDEX "Unit_name_idx" ON "Unit"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_code_key" ON "Ingredient"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_sku_key" ON "Ingredient"("sku");

-- CreateIndex
CREATE INDEX "Ingredient_categoryId_isActive_idx" ON "Ingredient"("categoryId", "isActive");

-- CreateIndex
CREATE INDEX "Ingredient_baseUnitId_idx" ON "Ingredient"("baseUnitId");

-- CreateIndex
CREATE INDEX "Ingredient_defaultPurchaseUnitId_idx" ON "Ingredient"("defaultPurchaseUnitId");

-- CreateIndex
CREATE INDEX "Ingredient_name_idx" ON "Ingredient"("name");

-- CreateIndex
CREATE INDEX "IngredientUnitConversion_unitId_idx" ON "IngredientUnitConversion"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "Allergen_code_key" ON "Allergen"("code");

-- CreateIndex
CREATE INDEX "Allergen_isActive_name_idx" ON "Allergen"("isActive", "name");

-- CreateIndex
CREATE INDEX "IngredientAllergen_allergenId_idx" ON "IngredientAllergen"("allergenId");

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "IngredientCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_baseUnitId_fkey" FOREIGN KEY ("baseUnitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_defaultPurchaseUnitId_fkey" FOREIGN KEY ("defaultPurchaseUnitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientUnitConversion" ADD CONSTRAINT "IngredientUnitConversion_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientUnitConversion" ADD CONSTRAINT "IngredientUnitConversion_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientAllergen" ADD CONSTRAINT "IngredientAllergen_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientAllergen" ADD CONSTRAINT "IngredientAllergen_allergenId_fkey" FOREIGN KEY ("allergenId") REFERENCES "Allergen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- PostgreSQL safeguards not represented by Prisma schema diff
-- ============================================================

ALTER TABLE "Unit"
ADD CONSTRAINT "Unit_factorToCanonical_dimension_check"
CHECK (
    (
        "dimension" IN ('MASS', 'VOLUME', 'COUNT')
        AND "factorToCanonical" IS NOT NULL
        AND "factorToCanonical" > 0
    )
    OR
    (
        "dimension" IN ('PORTION', 'PACKAGE')
        AND "factorToCanonical" IS NULL
    )
);

ALTER TABLE "IngredientUnitConversion"
ADD CONSTRAINT "IngredientUnitConversion_quantity_positive_check"
CHECK ("quantityInBaseUnit" > 0);

-- ============================================================
-- Deterministic standard unit catalogue
-- ============================================================

INSERT INTO "Unit" (
    "id",
    "code",
    "name",
    "symbol",
    "dimension",
    "factorToCanonical",
    "isActive",
    "createdAt",
    "updatedAt"
)
VALUES
    ('unit_g',     'G',     'Gram',       'g',     'MASS',    1.000000000,    TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('unit_kg',    'KG',    'Kilogram',   'kg',    'MASS',    1000.000000000, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('unit_ml',    'ML',    'Millilitre', 'ml',    'VOLUME',  1.000000000,    TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('unit_l',     'L',     'Litre',      'L',     'VOLUME',  1000.000000000, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('unit_each',  'EACH',  'Each',       'each',  'COUNT',   1.000000000,    TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('unit_dozen', 'DOZEN', 'Dozen',      'dozen', 'COUNT',   12.000000000,   TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('unit_scoop', 'SCOOP', 'Scoop',      'scoop', 'PORTION', NULL,           TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('unit_pack',  'PACK',  'Pack',       'pack',  'PACKAGE', NULL,           TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
