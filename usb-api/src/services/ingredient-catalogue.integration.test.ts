import test from "node:test";
import assert from "node:assert/strict";
import { AllergenPresence } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import {
  CatalogueError,
  createCategory,
  updateCategory,
  archiveCategory,
  createAllergen,
  updateAllergen,
  archiveAllergen,
  archiveIngredient,
  createIngredient,
  updateIngredient,
  getIngredient,
  listIngredients,
  setIngredientConversion,
  removeIngredientConversion,
  setIngredientAllergen,
} from "./ingredient-catalogue.service.js";
import { IngredientValidationError } from "./ingredient-validation.js";

// Fail closed: this test must never run against production.
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
    "Integration tests are restricted to approved disposable local databases.",
  );
}

test("ingredient catalogue database lifecycle and transaction safeguards", async () => {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const categoryCode = `IT_CAT_${suffix}`;
  const allergenCode = `IT_ALLERGEN_${suffix}`;
  const ingredientCode = `IT_PANEER_${suffix}`;
  const invalidIngredientCode = `IT_INVALID_${suffix}`;

  let categoryId: string | undefined;
  let allergenId: string | undefined;
  let ingredientId: string | undefined;

  try {
    // Confirm that the seeded reference units are present.
    const units = await prisma.unit.findMany({
      where: { id: { in: ["unit_g", "unit_kg", "unit_scoop", "unit_pack"] } },
    });

    assert.equal(units.length, 4, "Expected four seeded reference units");

    // Category creation and update.
    const category = await createCategory({
      code: categoryCode,
      name: "Integration Test Category",
      description: "Temporary integration fixture",
    });

    categoryId = category.id;

    assert.equal(category.code, categoryCode.toUpperCase());

    const updatedCategory = await updateCategory(category.id, {
      name: "Updated Integration Category",
    });

    assert.equal(updatedCategory.name, "Updated Integration Category");

    // Allergen creation and update.
    const allergen = await createAllergen({
      code: allergenCode,
      name: "Integration Test Allergen",
    });

    allergenId = allergen.id;

    const updatedAllergen = await updateAllergen(allergen.id, {
      name: "Updated Integration Allergen",
    });

    assert.equal(updatedAllergen.name, "Updated Integration Allergen");

    // An ingredient cannot use SCOOP as purchase unit without a
    // matching ingredient-specific conversion.
    await assert.rejects(
      createIngredient({
        code: invalidIngredientCode,
        name: "Invalid Test Ingredient",
        baseUnitId: "unit_g",
        defaultPurchaseUnitId: "unit_scoop",
      }),
      (error: unknown) =>
        error instanceof IngredientValidationError &&
        error.message.includes("ingredient-specific conversion"),
    );

    const invalidRecord = await prisma.ingredient.findUnique({
      where: { code: invalidIngredientCode },
    });

    assert.equal(invalidRecord, null, "Failed creation left no ingredient");

    // Valid ingredient creation with its own scoop weight.
    const ingredient = await createIngredient({
      code: ingredientCode,
      name: "Test Paneer",
      categoryId: category.id,
      baseUnitId: "unit_g",
      defaultPurchaseUnitId: "unit_scoop",
      isStockTracked: true,
      conversions: [
        {
          unitId: "unit_scoop",
          quantityInBaseUnit: "70",
          notes: "Test scoop weight",
        },
      ],
    });

    ingredientId = ingredient.id;

    assert.equal(ingredient.baseUnitId, "unit_g");
    assert.equal(ingredient.defaultPurchaseUnitId, "unit_scoop");
    assert.equal(ingredient.unitConversions.length, 1);

    // Create and update a package conversion.
    await setIngredientConversion(ingredient.id, "unit_pack", {
      quantityInBaseUnit: "500",
      notes: "Test package weight",
    });

    await setIngredientConversion(ingredient.id, "unit_pack", {
      quantityInBaseUnit: "550",
      notes: "Updated test package weight",
    });

    let current = await getIngredient(ingredient.id);

    const packConversion = current.unitConversions.find(
      (item) => item.unitId === "unit_pack",
    );

    assert.equal(packConversion?.quantityInBaseUnit.toString(), "550");

    // Attach allergen information.
    await setIngredientAllergen(ingredient.id, allergen.id, {
      presence: AllergenPresence.CONTAINS,
      notes: "Temporary integration test",
    });

    current = await getIngredient(ingredient.id);

    assert.equal(current.allergens.length, 1);
    assert.equal(
      current.allergens[0]?.presence,
      AllergenPresence.CONTAINS,
    );

    // Change the default purchase unit to PACK.
    const updatedIngredient = await updateIngredient(ingredient.id, {
      name: "Updated Test Paneer",
      defaultPurchaseUnitId: "unit_pack",
    });

    assert.equal(updatedIngredient.name, "Updated Test Paneer");
    assert.equal(updatedIngredient.defaultPurchaseUnitId, "unit_pack");

    // A non-default conversion can be removed.
    const removedScoop = await removeIngredientConversion(
      ingredient.id,
      "unit_scoop",
    );

    assert.equal(removedScoop.removed, true);

    // The active default purchase conversion cannot be removed.
    await assert.rejects(
      removeIngredientConversion(ingredient.id, "unit_pack"),
      (error: unknown) =>
        error instanceof CatalogueError && error.statusCode === 409,
    );

    // First clear the default purchase unit, then remove its conversion.
    await updateIngredient(ingredient.id, {
      defaultPurchaseUnitId: null,
    });

    const removedPack = await removeIngredientConversion(
      ingredient.id,
      "unit_pack",
    );

    assert.equal(removedPack.removed, true);

    // Archiving must preserve the records rather than physically deleting.
    await archiveCategory(category.id);
    await archiveAllergen(allergen.id);
    await archiveIngredient(ingredient.id);

    current = await getIngredient(ingredient.id);

    assert.equal(current.isActive, false);
    assert.equal(current.allergens.length, 1);
    assert.equal(current.allergens[0]?.allergen.isActive, false);

    const activeList = await listIngredients({
      query: ingredientCode,
    });

    assert.equal(
      activeList.some((item) => item.id === ingredient.id),
      false,
    );

    const includingInactive = await listIngredients({
      query: ingredientCode,
      includeInactive: true,
    });

    assert.equal(
      includingInactive.some((item) => item.id === ingredient.id),
      true,
    );

    console.log("PASS: Reference units and category lifecycle");
    console.log("PASS: Allergen lifecycle");
    console.log("PASS: Invalid creation rejected without partial record");
    console.log("PASS: Ingredient creation and scoop conversion");
    console.log("PASS: Package conversion create and update");
    console.log("PASS: Allergen association");
    console.log("PASS: Default purchase conversion protection");
    console.log("PASS: Soft archive and inactive filtering");
  } finally {
    // Remove only records created by this test, in dependency order.
    await prisma.$transaction(async (tx) => {
      if (ingredientId) {
        await tx.ingredientAllergen.deleteMany({
          where: { ingredientId },
        });

        await tx.ingredientUnitConversion.deleteMany({
          where: { ingredientId },
        });

        await tx.ingredient.deleteMany({
          where: { id: ingredientId },
        });
      }

      if (allergenId) {
        await tx.ingredientAllergen.deleteMany({
          where: { allergenId },
        });

        await tx.allergen.deleteMany({
          where: { id: allergenId },
        });
      }

      if (categoryId) {
        await tx.ingredientCategory.deleteMany({
          where: { id: categoryId },
        });
      }
    });

    await prisma.$disconnect();
  }
});
