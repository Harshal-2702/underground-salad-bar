import { UnitDimension } from "@prisma/client";

export class IngredientValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IngredientValidationError";
  }
}

export interface UnitReference {
  id: string;
  dimension: UnitDimension;
  factorToCanonical: string | number | null;
  isActive: boolean;
}

const BASE_DIMENSIONS = new Set<UnitDimension>([
  UnitDimension.MASS,
  UnitDimension.VOLUME,
  UnitDimension.COUNT,
]);

function isPositiveDecimal(
  value: string | number | null,
  maxScale: number,
): boolean {
  if (value === null) return false;

  const raw = String(value).trim();
  const maxIntegerDigits = 18 - maxScale;
  const pattern = new RegExp(
    `^\\d{1,${maxIntegerDigits}}(?:\\.\\d{1,${maxScale}})?$`,
  );

  return pattern.test(raw) && Number.isFinite(Number(raw)) && Number(raw) > 0;
}

function hasGlobalConversionFactor(unit: UnitReference): boolean {
  return isPositiveDecimal(unit.factorToCanonical, 9);
}

export function assertValidBaseUnit(unit: UnitReference): void {
  if (!unit.isActive) {
    throw new IngredientValidationError("The base unit is inactive.");
  }

  if (!BASE_DIMENSIONS.has(unit.dimension)) {
    throw new IngredientValidationError(
      "An ingredient base unit must use MASS, VOLUME or COUNT.",
    );
  }

  if (!hasGlobalConversionFactor(unit)) {
    throw new IngredientValidationError(
      "The ingredient base unit must have a positive canonical conversion factor.",
    );
  }
}

export function usesGlobalConversion(
  baseUnit: UnitReference,
  targetUnit: UnitReference,
): boolean {
  return (
    baseUnit.dimension === targetUnit.dimension &&
    BASE_DIMENSIONS.has(baseUnit.dimension) &&
    hasGlobalConversionFactor(baseUnit) &&
    hasGlobalConversionFactor(targetUnit)
  );
}

export function requiresIngredientSpecificConversion(
  baseUnit: UnitReference,
  targetUnit: UnitReference,
): boolean {
  if (baseUnit.id === targetUnit.id) return false;
  return !usesGlobalConversion(baseUnit, targetUnit);
}

export function assertPurchaseUnitCompatible(
  baseUnit: UnitReference,
  purchaseUnit: UnitReference,
  ingredientConversionUnitIds: ReadonlySet<string>,
): void {
  assertValidBaseUnit(baseUnit);

  if (!purchaseUnit.isActive) {
    throw new IngredientValidationError("The purchase unit is inactive.");
  }

  if (
    requiresIngredientSpecificConversion(baseUnit, purchaseUnit) &&
    !ingredientConversionUnitIds.has(purchaseUnit.id)
  ) {
    throw new IngredientValidationError(
      "This purchase unit requires an ingredient-specific conversion to the base unit.",
    );
  }
}

export function assertValidIngredientConversion(
  baseUnit: UnitReference,
  conversionUnit: UnitReference,
  quantityInBaseUnit: string | number,
): void {
  assertValidBaseUnit(baseUnit);

  if (!conversionUnit.isActive) {
    throw new IngredientValidationError("The conversion unit is inactive.");
  }

  if (baseUnit.id === conversionUnit.id) {
    throw new IngredientValidationError(
      "A unit cannot be converted to itself.",
    );
  }

  if (usesGlobalConversion(baseUnit, conversionUnit)) {
    throw new IngredientValidationError(
      "This unit already has a global conversion factor. Do not override it per ingredient.",
    );
  }

  if (!isPositiveDecimal(quantityInBaseUnit, 6)) {
    throw new IngredientValidationError(
      "Conversion quantity must be positive and have at most 6 decimal places.",
    );
  }
}
