-- CreateEnum
CREATE TYPE "RecipeType" AS ENUM ('PREPARATION', 'MENU_ITEM', 'BOWL_COMPONENT');

-- CreateEnum
CREATE TYPE "RecipeVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "recipeType" "RecipeType" NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeVersion" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "RecipeVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "recipeCodeSnapshot" VARCHAR(64) NOT NULL,
    "recipeNameSnapshot" VARCHAR(160) NOT NULL,
    "recipeTypeSnapshot" "RecipeType" NOT NULL,
    "outputQuantity" DECIMAL(18,6) NOT NULL,
    "outputUnitId" TEXT NOT NULL,
    "outputUnitCodeSnapshot" VARCHAR(32) NOT NULL,
    "outputUnitNameSnapshot" VARCHAR(80) NOT NULL,
    "outputUnitSymbolSnapshot" VARCHAR(16) NOT NULL,
    "yieldNotes" TEXT,
    "changeSummary" TEXT,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredientLine" (
    "id" TEXT NOT NULL,
    "recipeVersionId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "ingredientCodeSnapshot" VARCHAR(64) NOT NULL,
    "ingredientNameSnapshot" VARCHAR(160) NOT NULL,
    "unitCodeSnapshot" VARCHAR(32) NOT NULL,
    "unitNameSnapshot" VARCHAR(80) NOT NULL,
    "unitSymbolSnapshot" VARCHAR(16) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeIngredientLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeSubrecipeLine" (
    "id" TEXT NOT NULL,
    "recipeVersionId" TEXT NOT NULL,
    "componentRecipeVersionId" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "componentRecipeCodeSnapshot" VARCHAR(64) NOT NULL,
    "componentRecipeNameSnapshot" VARCHAR(160) NOT NULL,
    "componentVersionNumberSnapshot" INTEGER NOT NULL,
    "componentOutputUnitCodeSnapshot" VARCHAR(32) NOT NULL,
    "componentOutputUnitNameSnapshot" VARCHAR(80) NOT NULL,
    "componentOutputUnitSymbolSnapshot" VARCHAR(16) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeSubrecipeLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeStep" (
    "id" TEXT NOT NULL,
    "recipeVersionId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "title" VARCHAR(160),
    "instruction" TEXT NOT NULL,
    "timerSeconds" INTEGER,

    CONSTRAINT "RecipeStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_code_key" ON "Recipe"("code");

-- CreateIndex
CREATE INDEX "Recipe_recipeType_isActive_idx" ON "Recipe"("recipeType", "isActive");

-- CreateIndex
CREATE INDEX "Recipe_name_idx" ON "Recipe"("name");

-- CreateIndex
CREATE INDEX "RecipeVersion_recipeId_status_idx" ON "RecipeVersion"("recipeId", "status");

-- CreateIndex
CREATE INDEX "RecipeVersion_outputUnitId_idx" ON "RecipeVersion"("outputUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeVersion_recipeId_versionNumber_key" ON "RecipeVersion"("recipeId", "versionNumber");

-- CreateIndex
CREATE INDEX "RecipeIngredientLine_recipeVersionId_sortOrder_idx" ON "RecipeIngredientLine"("recipeVersionId", "sortOrder");

-- CreateIndex
CREATE INDEX "RecipeIngredientLine_ingredientId_idx" ON "RecipeIngredientLine"("ingredientId");

-- CreateIndex
CREATE INDEX "RecipeIngredientLine_unitId_idx" ON "RecipeIngredientLine"("unitId");

-- CreateIndex
CREATE INDEX "RecipeSubrecipeLine_recipeVersionId_sortOrder_idx" ON "RecipeSubrecipeLine"("recipeVersionId", "sortOrder");

-- CreateIndex
CREATE INDEX "RecipeSubrecipeLine_componentRecipeVersionId_idx" ON "RecipeSubrecipeLine"("componentRecipeVersionId");

-- CreateIndex
CREATE INDEX "RecipeStep_recipeVersionId_idx" ON "RecipeStep"("recipeVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeStep_recipeVersionId_stepNumber_key" ON "RecipeStep"("recipeVersionId", "stepNumber");

-- AddForeignKey
ALTER TABLE "RecipeVersion" ADD CONSTRAINT "RecipeVersion_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVersion" ADD CONSTRAINT "RecipeVersion_outputUnitId_fkey" FOREIGN KEY ("outputUnitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredientLine" ADD CONSTRAINT "RecipeIngredientLine_recipeVersionId_fkey" FOREIGN KEY ("recipeVersionId") REFERENCES "RecipeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredientLine" ADD CONSTRAINT "RecipeIngredientLine_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredientLine" ADD CONSTRAINT "RecipeIngredientLine_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeSubrecipeLine" ADD CONSTRAINT "RecipeSubrecipeLine_recipeVersionId_fkey" FOREIGN KEY ("recipeVersionId") REFERENCES "RecipeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeSubrecipeLine" ADD CONSTRAINT "RecipeSubrecipeLine_componentRecipeVersionId_fkey" FOREIGN KEY ("componentRecipeVersionId") REFERENCES "RecipeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeStep" ADD CONSTRAINT "RecipeStep_recipeVersionId_fkey" FOREIGN KEY ("recipeVersionId") REFERENCES "RecipeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- UKOS RECIPE STUDIO DATABASE SAFEGUARDS v1

-- Positive quantities and sequence numbers.
ALTER TABLE "RecipeVersion"
ADD CONSTRAINT "RecipeVersion_outputQuantity_positive_check"
CHECK ("outputQuantity" > 0);

ALTER TABLE "RecipeVersion"
ADD CONSTRAINT "RecipeVersion_versionNumber_positive_check"
CHECK ("versionNumber" > 0);

ALTER TABLE "RecipeIngredientLine"
ADD CONSTRAINT "RecipeIngredientLine_quantity_positive_check"
CHECK ("quantity" > 0);

ALTER TABLE "RecipeSubrecipeLine"
ADD CONSTRAINT "RecipeSubrecipeLine_quantity_positive_check"
CHECK ("quantity" > 0);

ALTER TABLE "RecipeStep"
ADD CONSTRAINT "RecipeStep_stepNumber_positive_check"
CHECK ("stepNumber" > 0);

ALTER TABLE "RecipeStep"
ADD CONSTRAINT "RecipeStep_timerSeconds_nonnegative_check"
CHECK ("timerSeconds" IS NULL OR "timerSeconds" >= 0);

-- One published version per recipe.
CREATE UNIQUE INDEX "RecipeVersion_one_published_per_recipe_key"
ON "RecipeVersion" ("recipeId")
WHERE "status" = 'PUBLISHED';


-- ============================================================
-- Recipe version lifecycle
-- ============================================================

CREATE OR REPLACE FUNCTION "ukos_recipe_version_guard"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_recipe "Recipe"%ROWTYPE;
    v_unit "Unit"%ROWTYPE;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW."status" <> 'DRAFT' THEN
            RAISE EXCEPTION 'New recipe versions must begin as DRAFT.';
        END IF;

        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD."status" <> 'DRAFT' THEN
            RAISE EXCEPTION 'Only draft recipe versions may be deleted.';
        END IF;

        RETURN OLD;
    END IF;

    IF NEW."id" IS DISTINCT FROM OLD."id"
       OR NEW."recipeId" IS DISTINCT FROM OLD."recipeId"
       OR NEW."versionNumber" IS DISTINCT FROM OLD."versionNumber" THEN
        RAISE EXCEPTION 'Recipe version identity is immutable.';
    END IF;

    IF OLD."status" = 'DRAFT' THEN

        IF NEW."status" NOT IN ('DRAFT', 'PUBLISHED', 'ARCHIVED') THEN
            RAISE EXCEPTION 'Invalid recipe version status transition.';
        END IF;

        IF NEW."status" = 'ARCHIVED' THEN
            NEW."archivedAt" := COALESCE(NEW."archivedAt", clock_timestamp());
            RETURN NEW;
        END IF;

        IF NEW."status" = 'PUBLISHED' THEN

            -- Use a server-generated publication timestamp.
            NEW."publishedAt" := clock_timestamp();

            IF NEW."archivedAt" IS NOT NULL THEN
                RAISE EXCEPTION 'A published version cannot have an archive timestamp.';
            END IF;

            SELECT * INTO v_recipe
            FROM "Recipe"
            WHERE "id" = NEW."recipeId";

            IF NOT FOUND OR NOT v_recipe."isActive" THEN
                RAISE EXCEPTION 'Recipe is missing or inactive.';
            END IF;

            SELECT * INTO v_unit
            FROM "Unit"
            WHERE "id" = NEW."outputUnitId";

            IF NOT FOUND OR NOT v_unit."isActive" THEN
                RAISE EXCEPTION 'Recipe output unit is missing or inactive.';
            END IF;

            IF NEW."recipeCodeSnapshot" IS DISTINCT FROM v_recipe."code"
               OR NEW."recipeNameSnapshot" IS DISTINCT FROM v_recipe."name"
               OR NEW."recipeTypeSnapshot" IS DISTINCT FROM v_recipe."recipeType" THEN
                RAISE EXCEPTION 'Recipe identity snapshots do not match the recipe.';
            END IF;

            IF NEW."outputUnitCodeSnapshot" IS DISTINCT FROM v_unit."code"
               OR NEW."outputUnitNameSnapshot" IS DISTINCT FROM v_unit."name"
               OR NEW."outputUnitSymbolSnapshot" IS DISTINCT FROM v_unit."symbol" THEN
                RAISE EXCEPTION 'Output unit snapshots do not match the unit.';
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM "RecipeIngredientLine"
                WHERE "recipeVersionId" = NEW."id"
            ) AND NOT EXISTS (
                SELECT 1 FROM "RecipeSubrecipeLine"
                WHERE "recipeVersionId" = NEW."id"
            ) THEN
                RAISE EXCEPTION 'A recipe needs at least one ingredient or sub-recipe.';
            END IF;

            -- Recheck all ingredient lines at publication time.
            IF EXISTS (
                SELECT 1
                FROM "RecipeIngredientLine" l
                JOIN "Ingredient" i ON i."id" = l."ingredientId"
                JOIN "Unit" u ON u."id" = l."unitId"
                WHERE l."recipeVersionId" = NEW."id"
                  AND (
                      NOT i."isActive"
                      OR NOT u."isActive"
                      OR l."unitId" IS DISTINCT FROM i."baseUnitId"
                      OR l."ingredientCodeSnapshot" IS DISTINCT FROM i."code"
                      OR l."ingredientNameSnapshot" IS DISTINCT FROM i."name"
                      OR l."unitCodeSnapshot" IS DISTINCT FROM u."code"
                      OR l."unitNameSnapshot" IS DISTINCT FROM u."name"
                      OR l."unitSymbolSnapshot" IS DISTINCT FROM u."symbol"
                  )
            ) THEN
                RAISE EXCEPTION 'Ingredient lines contain inactive or mismatched ingredient/unit data.';
            END IF;

            -- Sub-recipe dependencies must point strictly backward in publication time.
            -- This makes dependency cycles impossible.
            IF EXISTS (
                SELECT 1
                FROM "RecipeSubrecipeLine" l
                JOIN "RecipeVersion" c
                  ON c."id" = l."componentRecipeVersionId"
                WHERE l."recipeVersionId" = NEW."id"
                  AND (
                      c."status" NOT IN ('PUBLISHED', 'SUPERSEDED')
                      OR c."publishedAt" IS NULL
                      OR c."publishedAt" >= NEW."publishedAt"
                      OR c."recipeId" = NEW."recipeId"
                      OR c."recipeCodeSnapshot" IS DISTINCT FROM l."componentRecipeCodeSnapshot"
                      OR c."recipeNameSnapshot" IS DISTINCT FROM l."componentRecipeNameSnapshot"
                      OR c."versionNumber" IS DISTINCT FROM l."componentVersionNumberSnapshot"
                      OR c."outputUnitCodeSnapshot" IS DISTINCT FROM l."componentOutputUnitCodeSnapshot"
                      OR c."outputUnitNameSnapshot" IS DISTINCT FROM l."componentOutputUnitNameSnapshot"
                      OR c."outputUnitSymbolSnapshot" IS DISTINCT FROM l."componentOutputUnitSymbolSnapshot"
                  )
            ) THEN
                RAISE EXCEPTION 'Sub-recipe lines contain invalid, circular or stale version references.';
            END IF;

        END IF;

        RETURN NEW;
    END IF;

    -- Only a published version may transition to SUPERSEDED.
    -- Its recipe contents and all snapshots remain unchanged.
    IF OLD."status" = 'PUBLISHED' AND NEW."status" = 'SUPERSEDED' THEN

        IF (to_jsonb(NEW) - 'status' - 'updatedAt')
           IS DISTINCT FROM
           (to_jsonb(OLD) - 'status' - 'updatedAt') THEN
            RAISE EXCEPTION 'Published recipe contents are immutable.';
        END IF;

        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Published, superseded and archived recipe versions cannot be edited.';
END;
$$;

CREATE TRIGGER "RecipeVersion_immutable_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "RecipeVersion"
FOR EACH ROW
EXECUTE FUNCTION "ukos_recipe_version_guard"();


-- ============================================================
-- Only draft versions may have child content changed.
-- Applies to ingredient lines, sub-recipe lines and steps.
-- ============================================================

CREATE OR REPLACE FUNCTION "ukos_recipe_child_draft_guard"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_parent_id TEXT;
    v_status TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_parent_id := OLD."recipeVersionId";
    ELSE
        IF TG_OP = 'UPDATE'
           AND NEW."recipeVersionId" IS DISTINCT FROM OLD."recipeVersionId" THEN
            RAISE EXCEPTION 'Recipe content cannot be moved between versions.';
        END IF;

        v_parent_id := NEW."recipeVersionId";
    END IF;

    SELECT "status"::text INTO v_status
    FROM "RecipeVersion"
    WHERE "id" = v_parent_id
    FOR UPDATE;

    IF NOT FOUND OR v_status IS DISTINCT FROM 'DRAFT' THEN
        RAISE EXCEPTION 'Recipe contents may only be changed while the version is DRAFT.';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "RecipeIngredientLine_00_draft_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "RecipeIngredientLine"
FOR EACH ROW
EXECUTE FUNCTION "ukos_recipe_child_draft_guard"();

CREATE TRIGGER "RecipeSubrecipeLine_00_draft_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "RecipeSubrecipeLine"
FOR EACH ROW
EXECUTE FUNCTION "ukos_recipe_child_draft_guard"();

CREATE TRIGGER "RecipeStep_00_draft_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "RecipeStep"
FOR EACH ROW
EXECUTE FUNCTION "ukos_recipe_child_draft_guard"();


-- ============================================================
-- Ingredient lines: base units and snapshots must be correct.
-- ============================================================

CREATE OR REPLACE FUNCTION "ukos_recipe_ingredient_line_guard"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_ingredient_code TEXT;
    v_ingredient_name TEXT;
    v_base_unit_id TEXT;
    v_ingredient_active BOOLEAN;
    v_unit_code TEXT;
    v_unit_name TEXT;
    v_unit_symbol TEXT;
    v_unit_active BOOLEAN;
BEGIN
    SELECT i."code", i."name", i."baseUnitId", i."isActive",
           u."code", u."name", u."symbol", u."isActive"
    INTO v_ingredient_code, v_ingredient_name, v_base_unit_id,
         v_ingredient_active, v_unit_code, v_unit_name,
         v_unit_symbol, v_unit_active
    FROM "Ingredient" i
    JOIN "Unit" u ON u."id" = NEW."unitId"
    WHERE i."id" = NEW."ingredientId";

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ingredient or measurement unit does not exist.';
    END IF;

    IF NOT v_ingredient_active OR NOT v_unit_active THEN
        RAISE EXCEPTION 'Inactive ingredients and units cannot be added to a recipe.';
    END IF;

    IF NEW."unitId" IS DISTINCT FROM v_base_unit_id THEN
        RAISE EXCEPTION 'Recipe ingredient quantities must use the ingredient base unit.';
    END IF;

    IF NEW."ingredientCodeSnapshot" IS DISTINCT FROM v_ingredient_code
       OR NEW."ingredientNameSnapshot" IS DISTINCT FROM v_ingredient_name
       OR NEW."unitCodeSnapshot" IS DISTINCT FROM v_unit_code
       OR NEW."unitNameSnapshot" IS DISTINCT FROM v_unit_name
       OR NEW."unitSymbolSnapshot" IS DISTINCT FROM v_unit_symbol THEN
        RAISE EXCEPTION 'Ingredient or unit snapshots do not match the selected records.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "RecipeIngredientLine_10_snapshot_guard"
BEFORE INSERT OR UPDATE ON "RecipeIngredientLine"
FOR EACH ROW
EXECUTE FUNCTION "ukos_recipe_ingredient_line_guard"();


-- ============================================================
-- Sub-recipes: only earlier published versions of other recipes.
-- Strict publication ordering prevents indirect dependency cycles.
-- ============================================================

CREATE OR REPLACE FUNCTION "ukos_recipe_subrecipe_line_guard"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_parent_recipe_id TEXT;
    v_parent_status TEXT;
    v_component_recipe_id TEXT;
    v_component_status TEXT;
    v_component_code TEXT;
    v_component_name TEXT;
    v_component_version INTEGER;
    v_unit_code TEXT;
    v_unit_name TEXT;
    v_unit_symbol TEXT;
BEGIN
    SELECT "recipeId", "status"::text
    INTO v_parent_recipe_id, v_parent_status
    FROM "RecipeVersion"
    WHERE "id" = NEW."recipeVersionId";

    IF NOT FOUND OR v_parent_status <> 'DRAFT' THEN
        RAISE EXCEPTION 'The parent recipe version must be a draft.';
    END IF;

    SELECT c."recipeId", c."status"::text,
           c."recipeCodeSnapshot", c."recipeNameSnapshot",
           c."versionNumber", c."outputUnitCodeSnapshot",
           c."outputUnitNameSnapshot", c."outputUnitSymbolSnapshot"
    INTO v_component_recipe_id, v_component_status,
         v_component_code, v_component_name, v_component_version,
         v_unit_code, v_unit_name, v_unit_symbol
    FROM "RecipeVersion" c
    WHERE c."id" = NEW."componentRecipeVersionId";

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Referenced sub-recipe version does not exist.';
    END IF;

    IF v_component_status NOT IN ('PUBLISHED', 'SUPERSEDED') THEN
        RAISE EXCEPTION 'Sub-recipes must reference an already-published version.';
    END IF;

    IF v_parent_recipe_id = v_component_recipe_id THEN
        RAISE EXCEPTION 'A recipe cannot use another version of itself as a sub-recipe.';
    END IF;

    IF NEW."componentRecipeCodeSnapshot" IS DISTINCT FROM v_component_code
       OR NEW."componentRecipeNameSnapshot" IS DISTINCT FROM v_component_name
       OR NEW."componentVersionNumberSnapshot" IS DISTINCT FROM v_component_version
       OR NEW."componentOutputUnitCodeSnapshot" IS DISTINCT FROM v_unit_code
       OR NEW."componentOutputUnitNameSnapshot" IS DISTINCT FROM v_unit_name
       OR NEW."componentOutputUnitSymbolSnapshot" IS DISTINCT FROM v_unit_symbol THEN
        RAISE EXCEPTION 'Sub-recipe snapshots do not match the referenced version.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "RecipeSubrecipeLine_10_snapshot_guard"
BEFORE INSERT OR UPDATE ON "RecipeSubrecipeLine"
FOR EACH ROW
EXECUTE FUNCTION "ukos_recipe_subrecipe_line_guard"();

-- End Recipe Studio safeguards.