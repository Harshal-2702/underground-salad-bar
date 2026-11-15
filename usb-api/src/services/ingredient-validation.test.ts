import test from "node:test";
import assert from "node:assert/strict";
import { UnitDimension } from "@prisma/client";

import {
  IngredientValidationError,
  assertValidBaseUnit,
  assertPurchaseUnitCompatible,
  assertValidIngredientConversion,
  requiresIngredientSpecificConversion,
} from "./ingredient-validation.js";

function unit(
  id: string,
  dimension: UnitDimension,
  factorToCanonical: string | null,
  isActive = true,
) {
  return { id, dimension, factorToCanonical, isActive };
}

const gram = unit("unit_g", UnitDimension.MASS, "1");
const kilogram = unit("unit_kg", UnitDimension.MASS, "1000");
const millilitre = unit("unit_ml", UnitDimension.VOLUME, "1");
const each = unit("unit_each", UnitDimension.COUNT, "1");
const scoop = unit("unit_scoop", UnitDimension.PORTION, null);
const pack = unit("unit_pack", UnitDimension.PACKAGE, null);

test("accepts MASS, VOLUME and COUNT as base dimensions", () => {
  assert.doesNotThrow(() => assertValidBaseUnit(gram));
  assert.doesNotThrow(() => assertValidBaseUnit(millilitre));
  assert.doesNotThrow(() => assertValidBaseUnit(each));
});

test("rejects PORTION and PACKAGE as ingredient base dimensions", () => {
  assert.throws(
    () => assertValidBaseUnit(scoop),
    IngredientValidationError,
  );
  assert.throws(
    () => assertValidBaseUnit(pack),
    IngredientValidationError,
  );
});

test("rejects inactive base units", () => {
  assert.throws(
    () => assertValidBaseUnit(unit("inactive_g", UnitDimension.MASS, "1", false)),
    IngredientValidationError,
  );
});

test("uses global conversion for compatible mass units", () => {
  assert.equal(
    requiresIngredientSpecificConversion(gram, kilogram),
    false,
  );

  assert.doesNotThrow(() =>
    assertPurchaseUnitCompatible(gram, kilogram, new Set()),
  );
});

test("requires ingredient-specific conversion for a scoop purchase unit", () => {
  assert.equal(
    requiresIngredientSpecificConversion(gram, scoop),
    true,
  );

  assert.throws(
    () => assertPurchaseUnitCompatible(gram, scoop, new Set()),
    IngredientValidationError,
  );

  assert.doesNotThrow(() =>
    assertPurchaseUnitCompatible(gram, scoop, new Set(["unit_scoop"])),
  );
});

test("requires ingredient-specific conversion for cross-dimension units", () => {
  assert.throws(
    () => assertPurchaseUnitCompatible(gram, millilitre, new Set()),
    IngredientValidationError,
  );

  assert.doesNotThrow(() =>
    assertPurchaseUnitCompatible(gram, millilitre, new Set(["unit_ml"])),
  );
});

test("accepts positive ingredient-specific scoop conversion", () => {
  assert.doesNotThrow(() =>
    assertValidIngredientConversion(gram, scoop, "70"),
  );
});

test("accepts positive package conversion with decimal precision", () => {
  assert.doesNotThrow(() =>
    assertValidIngredientConversion(gram, pack, "1250.500000"),
  );
});

test("rejects zero, negative and excessive-precision conversions", () => {
  assert.throws(
    () => assertValidIngredientConversion(gram, scoop, "0"),
    IngredientValidationError,
  );

  assert.throws(
    () => assertValidIngredientConversion(gram, scoop, "-10"),
    IngredientValidationError,
  );

  assert.throws(
    () => assertValidIngredientConversion(gram, scoop, "1.1234567"),
    IngredientValidationError,
  );
});

test("rejects conversion to the same base unit", () => {
  assert.throws(
    () => assertValidIngredientConversion(gram, gram, "1"),
    IngredientValidationError,
  );
});

test("rejects ingredient-specific overrides of globally convertible units", () => {
  assert.throws(
    () => assertValidIngredientConversion(gram, kilogram, "1000"),
    IngredientValidationError,
  );
});

test("rejects inactive conversion units", () => {
  const inactiveScoop = unit(
    "inactive_scoop",
    UnitDimension.PORTION,
    null,
    false,
  );

  assert.throws(
    () => assertValidIngredientConversion(gram, inactiveScoop, "70"),
    IngredientValidationError,
  );
});

test("enforces Decimal(18,9) precision for global unit factors", () => {
  assert.doesNotThrow(() =>
    assertValidBaseUnit(
      unit("boundary_g", UnitDimension.MASS, "999999999.999999999"),
    ),
  );

  assert.throws(
    () =>
      assertValidBaseUnit(
        unit("overflow_g", UnitDimension.MASS, "1000000000"),
      ),
    IngredientValidationError,
  );
});

test("enforces Decimal(18,6) precision for ingredient conversions", () => {
  assert.doesNotThrow(() =>
    assertValidIngredientConversion(
      gram,
      scoop,
      "999999999999.999999",
    ),
  );

  assert.throws(
    () =>
      assertValidIngredientConversion(
        gram,
        scoop,
        "1000000000000",
      ),
    IngredientValidationError,
  );
});
