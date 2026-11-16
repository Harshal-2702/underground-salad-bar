import test from "node:test";
import assert from "node:assert/strict";
import { Prisma, RecipeType } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import {
  RecipeError,
  createRecipe,
  createDraftVersion,
  addIngredientLine,
  addSubrecipeLine,
  replaceRecipeSteps,
  publishRecipeVersion,
  updateDraftVersion,
  listRecipes,
  updateRecipe,
  archiveRecipe,
  restoreRecipe,
  archiveDraftVersion,
} from "./recipe.service.js";

// Fail closed: never run against production.
const configuredUrl = process.env.DATABASE_URL;

if (!configuredUrl) {
  throw new Error("DATABASE_URL is missing.");
}

const databaseUrl = new URL(configuredUrl);

const allowedTestDatabases = new Set([
  "/ukos_test",
  "/ukos_migration_test_20261105",
]);

if (
  databaseUrl.hostname !== "127.0.0.1" ||
  databaseUrl.port !== "55432" ||
  !allowedTestDatabases.has(databaseUrl.pathname)
) {
  throw new Error(
    "Recipe integration tests are restricted to approved local test databases.",
  );
}

test("Recipe Studio lifecycle, measurement validation and immutability", async () => {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const recipeIds: string[] = [];
  const versionIds: string[] = [];

  try {
    // Use seeded reference records without modifying them.
    const [rice, gram, kilogram, each] = await Promise.all([
      prisma.ingredient.findFirst({
        where: { name: "Rice", isActive: true },
        include: { baseUnit: true },
      }),
      prisma.unit.findUnique({ where: { id: "unit_g" } }),
      prisma.unit.findUnique({ where: { id: "unit_kg" } }),
      prisma.unit.findUnique({ where: { id: "unit_each" } }),
    ]);

    assert.ok(rice, "Seeded Rice ingredient must exist");
    assert.ok(gram?.isActive, "Gram unit must exist and be active");
    assert.ok(kilogram?.isActive, "Kilogram unit must exist and be active");
    assert.ok(each?.isActive, "Each unit must exist and be active");
    assert.equal(rice.baseUnitId, gram.id);

    // --------------------------------------------------------
    // Create a preparation recipe and its first draft version.
    // All quantities below are disposable test fixtures only.
    // --------------------------------------------------------

    const component = await createRecipe({
      code: `IT_PREP_${suffix}`,
      name: "Integration Test Preparation",
      recipeType: RecipeType.PREPARATION,
      outputQuantity: "100",
      outputUnitId: gram.id,
      changeSummary: "Temporary integration fixture",
    });

    recipeIds.push(component.id);

    const componentV1 = component.versions[0];
    assert.ok(componentV1);
    versionIds.push(componentV1.id);

    assert.equal(componentV1.status, "DRAFT");
    assert.equal(componentV1.outputUnitCodeSnapshot, gram.code);

    // Ingredient line automatically uses the ingredient base unit.
    const ingredientLine = await addIngredientLine(
      component.id,
      componentV1.id,
      {
        ingredientId: rice.id,
        quantity: "30",
      },
    );

    assert.equal(ingredientLine.unitId, rice.baseUnitId);
    assert.equal(
      ingredientLine.ingredientNameSnapshot,
      rice.name,
    );

    // Service-level validation rejects zero quantity.
    await assert.rejects(
      addIngredientLine(component.id, componentV1.id, {
        ingredientId: rice.id,
        quantity: "0",
      }),
      (error: unknown) =>
        error instanceof RecipeError && error.statusCode === 400,
    );

    // Database trigger rejects use of KG when Rice base unit is G.
    await assert.rejects(
      prisma.recipeIngredientLine.create({
        data: {
          recipeVersionId: componentV1.id,
          ingredientId: rice.id,
          unitId: kilogram.id,
          quantity: new Prisma.Decimal("10"),
          ingredientCodeSnapshot: rice.code,
          ingredientNameSnapshot: rice.name,
          unitCodeSnapshot: kilogram.code,
          unitNameSnapshot: kilogram.name,
          unitSymbolSnapshot: kilogram.symbol,
        },
      }),
    );

    // Database CHECK rejects zero quantity even when bypassing the service.
    await assert.rejects(
      prisma.recipeIngredientLine.create({
        data: {
          recipeVersionId: componentV1.id,
          ingredientId: rice.id,
          unitId: rice.baseUnitId,
          quantity: new Prisma.Decimal("0"),
          ingredientCodeSnapshot: rice.code,
          ingredientNameSnapshot: rice.name,
          unitCodeSnapshot: gram.code,
          unitNameSnapshot: gram.name,
          unitSymbolSnapshot: gram.symbol,
        },
      }),
    );

    // Preparation instructions.
    const steps = await replaceRecipeSteps(
      component.id,
      componentV1.id,
      [
        {
          stepNumber: 1,
          title: "Test preparation step",
          instruction: "Temporary integration test instruction.",
          timerSeconds: 60,
        },
      ],
    );

    assert.equal(steps.length, 1);
    assert.equal(steps[0]?.stepNumber, 1);

    // --------------------------------------------------------
    // Publish the component recipe.
    // --------------------------------------------------------

    const publishedComponent = await publishRecipeVersion(
      component.id,
      componentV1.id,
    );

    assert.equal(publishedComponent.status, "PUBLISHED");
    assert.ok(publishedComponent.publishedAt);

    // A published version cannot be edited through the service.
    await assert.rejects(
      updateDraftVersion(component.id, componentV1.id, {
        outputQuantity: "200",
      }),
      (error: unknown) =>
        error instanceof RecipeError && error.statusCode === 409,
    );

    // Database trigger independently blocks direct published edits.
    await assert.rejects(
      prisma.recipeVersion.update({
        where: { id: componentV1.id },
        data: { recipeNameSnapshot: "Tampered recipe name" },
      }),
    );

    // Database trigger blocks inserting content into published versions.
    await assert.rejects(
      prisma.recipeStep.create({
        data: {
          recipeVersionId: componentV1.id,
          stepNumber: 99,
          instruction: "This must be rejected.",
        },
      }),
    );

    // --------------------------------------------------------
    // Create a menu item referencing the exact published
    // preparation version.
    // --------------------------------------------------------

    const parent = await createRecipe({
      code: `IT_MENU_${suffix}`,
      name: "Integration Test Menu Item",
      recipeType: RecipeType.MENU_ITEM,
      outputQuantity: "1",
      outputUnitId: each.id,
    });

    recipeIds.push(parent.id);

    const parentV1 = parent.versions[0];
    assert.ok(parentV1);
    versionIds.push(parentV1.id);

    const subrecipeLine = await addSubrecipeLine(
      parent.id,
      parentV1.id,
      {
        componentRecipeVersionId: componentV1.id,
        quantity: "50",
      },
    );

    assert.equal(
      subrecipeLine.componentVersionNumberSnapshot,
      1,
    );

    const publishedParent = await publishRecipeVersion(
      parent.id,
      parentV1.id,
    );

    assert.equal(publishedParent.status, "PUBLISHED");

    // --------------------------------------------------------
    // A new version copies the previous contents into a draft.
    // --------------------------------------------------------

    const componentDraft = await createDraftVersion(
      component.id,
      "Temporary second-version test",
    );

    versionIds.push(componentDraft.id);

    assert.equal(componentDraft.versionNumber, 2);
    assert.equal(componentDraft.status, "DRAFT");
    assert.equal(componentDraft.ingredientLines.length, 1);
    assert.equal(componentDraft.steps.length, 1);

    // Cannot use another version of the same recipe as a sub-recipe.
    await assert.rejects(
      addSubrecipeLine(component.id, componentDraft.id, {
        componentRecipeVersionId: componentV1.id,
        quantity: "10",
      }),
      (error: unknown) =>
        error instanceof RecipeError && error.statusCode === 409,
    );

    // --------------------------------------------------------
    // An unpublished recipe cannot be used as a sub-recipe.
    // --------------------------------------------------------

    const blank = await createRecipe({
      code: `IT_BLANK_${suffix}`,
      name: "Integration Test Empty Recipe",
      recipeType: RecipeType.PREPARATION,
      outputQuantity: "1",
      outputUnitId: gram.id,
    });

    recipeIds.push(blank.id);

    const blankVersion = blank.versions[0];
    assert.ok(blankVersion);
    versionIds.push(blankVersion.id);

    const parentDraft = await createDraftVersion(
      parent.id,
      "Temporary parent version test",
    );

    versionIds.push(parentDraft.id);

    await assert.rejects(
      addSubrecipeLine(parent.id, parentDraft.id, {
        componentRecipeVersionId: blankVersion.id,
        quantity: "1",
      }),
      (error: unknown) =>
        error instanceof RecipeError && error.statusCode === 409,
    );

    // Empty recipe cannot be published.
    await assert.rejects(
      publishRecipeVersion(blank.id, blankVersion.id),
    );

    const blankAfterFailedPublish =
      await prisma.recipeVersion.findUniqueOrThrow({
        where: { id: blankVersion.id },
      });

    assert.equal(blankAfterFailedPublish.status, "DRAFT");

    // --------------------------------------------------------
    // Publishing V2 supersedes V1 without altering historical
    // references held by the parent menu item.
    // --------------------------------------------------------

    const publishedV2 = await publishRecipeVersion(
      component.id,
      componentDraft.id,
    );

    assert.equal(publishedV2.status, "PUBLISHED");

    const oldVersion = await prisma.recipeVersion.findUniqueOrThrow({
      where: { id: componentV1.id },
    });

    assert.equal(oldVersion.status, "SUPERSEDED");
    assert.equal(oldVersion.outputQuantity.toString(), "100");

    const storedParentLine =
      await prisma.recipeSubrecipeLine.findFirstOrThrow({
        where: {
          recipeVersionId: parentV1.id,
        },
      });

    assert.equal(
      storedParentLine.componentRecipeVersionId,
      componentV1.id,
    );

    // Only one published version exists for the component recipe.
    const publishedCount = await prisma.recipeVersion.count({
      where: {
        recipeId: component.id,
        status: "PUBLISHED",
      },
    });

    assert.equal(publishedCount, 1);

    console.log("PASS: Recipe and initial draft creation");
    console.log("PASS: Ingredient base-unit enforcement");
    console.log("PASS: Positive quantity validation at service and database");
    console.log("PASS: Preparation step creation");
    console.log("PASS: Published version content immutability");
    console.log("PASS: Published sub-recipe reference");
    console.log("PASS: Same-recipe and unpublished sub-recipe rejection");
    console.log("PASS: Empty recipe publication rejection");
    console.log("PASS: Draft copying and version superseding");
    console.log("PASS: Historical sub-recipe version remains pinned");
    // Recipe metadata edits update the current identity and editable draft
    // snapshot, but never rewrite published or superseded snapshots.
    const componentRenameDraft = await createDraftVersion(
      component.id,
      "Temporary recipe identity edit test",
    );
    versionIds.push(componentRenameDraft.id);

    const renamedComponent = await updateRecipe(component.id, {
      name: "Renamed Integration Test Preparation",
      description: "Updated integration-test description",
    });

    assert.equal(renamedComponent.name, "Renamed Integration Test Preparation");
    assert.equal(renamedComponent.description, "Updated integration-test description");

    const [historicalComponentVersion, latestPublishedComponentVersion, updatedDraftSnapshot] =
      await Promise.all([
        prisma.recipeVersion.findUniqueOrThrow({ where: { id: componentV1.id } }),
        prisma.recipeVersion.findUniqueOrThrow({ where: { id: publishedV2.id } }),
        prisma.recipeVersion.findUniqueOrThrow({ where: { id: componentRenameDraft.id } }),
      ]);

    assert.equal(historicalComponentVersion.recipeNameSnapshot, "Integration Test Preparation");
    assert.equal(latestPublishedComponentVersion.recipeNameSnapshot, "Integration Test Preparation");
    assert.equal(updatedDraftSnapshot.recipeNameSnapshot, "Renamed Integration Test Preparation");

    // A recipe with a draft cannot be archived.
    await assert.rejects(
      archiveRecipe(parent.id),
      (error: unknown) =>
        error instanceof RecipeError && error.statusCode === 409,
    );

    // Archive the unfinished draft, then archive and restore the recipe.
    const archivedParentDraft = await archiveDraftVersion(
      parent.id,
      parentDraft.id,
    );

    assert.equal(archivedParentDraft.status, "ARCHIVED");
    assert.ok(archivedParentDraft.archivedAt);

    const archivedParent = await archiveRecipe(parent.id);
    assert.equal(archivedParent.isActive, false);

    const restoredParent = await restoreRecipe(parent.id);
    assert.equal(restoredParent.isActive, true);

    // Archived recipes cannot be edited until restored.
    const archivedBlankDraft = await archiveDraftVersion(
      blank.id,
      blankVersion.id,
    );

    assert.equal(archivedBlankDraft.status, "ARCHIVED");

    const archivedBlank = await archiveRecipe(blank.id);
    assert.equal(archivedBlank.isActive, false);

    const [activeRecipeRows, allRecipeRows] = await Promise.all([
      listRecipes(),
      listRecipes(true),
    ]);
    assert.ok(!activeRecipeRows.some((recipe) => recipe.id === blank.id));
    assert.ok(allRecipeRows.some((recipe) => recipe.id === blank.id && !recipe.isActive));
    assert.ok(activeRecipeRows.some((recipe) => recipe.id === parent.id));

    await assert.rejects(
      updateRecipe(blank.id, { name: "Should Not Save" }),
      (error: unknown) =>
        error instanceof RecipeError && error.statusCode === 409,
    );
    console.log("PASS: One published version per recipe");
  } finally {
    try {
      // This test is fail-closed to approved local databases above.
      // Trigger disabling is transaction-scoped and only for fixture cleanup.
      await prisma.$transaction(async (tx) => {
        const current = await tx.$queryRaw<Array<{ database: string }>>`
          SELECT current_database() AS database
        `;

        if (current[0]?.database !== databaseUrl.pathname.slice(1)) {
          throw new Error("Database identity changed. Recipe cleanup refused.");
        }

        const ids = [...new Set(versionIds)];
        const uniqueRecipeIds = [...new Set(recipeIds)];

        if (ids.length > 0) {
          await tx.$executeRaw`
            ALTER TABLE "RecipeVersion" DISABLE TRIGGER USER
          `;
          await tx.$executeRaw`
            ALTER TABLE "RecipeIngredientLine" DISABLE TRIGGER USER
          `;
          await tx.$executeRaw`
            ALTER TABLE "RecipeSubrecipeLine" DISABLE TRIGGER USER
          `;
          await tx.$executeRaw`
            ALTER TABLE "RecipeStep" DISABLE TRIGGER USER
          `;

          try {
            // Remove only links involving fixture versions.
            await tx.recipeSubrecipeLine.deleteMany({
              where: {
                OR: [
                  { recipeVersionId: { in: ids } },
                  { componentRecipeVersionId: { in: ids } },
                ],
              },
            });

            await tx.recipeIngredientLine.deleteMany({
              where: { recipeVersionId: { in: ids } },
            });

            await tx.recipeStep.deleteMany({
              where: { recipeVersionId: { in: ids } },
            });

            await tx.recipeVersion.deleteMany({
              where: { id: { in: ids } },
            });

            if (uniqueRecipeIds.length > 0) {
              await tx.recipe.deleteMany({
                where: { id: { in: uniqueRecipeIds } },
              });
            }
          } finally {
            // Restore all database guards before this transaction commits.
            await tx.$executeRaw`
              ALTER TABLE "RecipeStep" ENABLE TRIGGER USER
            `;
            await tx.$executeRaw`
              ALTER TABLE "RecipeSubrecipeLine" ENABLE TRIGGER USER
            `;
            await tx.$executeRaw`
              ALTER TABLE "RecipeIngredientLine" ENABLE TRIGGER USER
            `;
            await tx.$executeRaw`
              ALTER TABLE "RecipeVersion" ENABLE TRIGGER USER
            `;
          }
        }
      });

      console.log("PASS: Test-only recipe fixtures cleaned up.");
    } finally {
      await prisma.$disconnect();
    }
  }
});