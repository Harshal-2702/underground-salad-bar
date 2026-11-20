import {
  AllergenPresence,
  Prisma,
  UnitDimension,
} from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import {
  IngredientValidationError,
  assertValidBaseUnit,
  assertPurchaseUnitCompatible,
  assertValidIngredientConversion,
} from "./ingredient-validation.js";

export class CatalogueError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 400 | 404 | 409 = 400,
  ) {
    super(message);
    this.name = "CatalogueError";
  }
}

export interface ConversionInput {
  unitId: string;
  quantityInBaseUnit: string;
  isApproximate?: boolean;
  notes?: string | null;
}

export interface CreateIngredientInput {
  code: string;
  sku?: string | null;
  name: string;
  description?: string | null;
  categoryId?: string | null;
  inventoryCategoryId?: string | null;
  baseUnitId: string;
  defaultPurchaseUnitId?: string | null;
  isStockTracked?: boolean;
  sortOrder?: number;
  conversions?: ConversionInput[];
}

export interface UpdateIngredientInput {
  code?: string;
  sku?: string | null;
  name?: string;
  description?: string | null;
  categoryId?: string | null;
  inventoryCategoryId?: string | null;
  baseUnitId?: string;
  defaultPurchaseUnitId?: string | null;
  isStockTracked?: boolean;
  sortOrder?: number;
}

export interface CategoryInput {
  code: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
}

export interface CategoryUpdateInput {
  code?: string;
  name?: string;
  description?: string | null;
  sortOrder?: number;
}

export interface AllergenInput {
  code: string;
  name: string;
}

export interface AllergenUpdateInput {
  code?: string;
  name?: string;
}

const ingredientInclude = {
  category: true,
  inventoryCategory: true,
  baseUnit: true,
  defaultPurchaseUnit: true,
  unitConversions: {
    include: { unit: true },
    orderBy: { unitId: "asc" as const },
  },
  allergens: {
    include: { allergen: true },
    orderBy: { allergenId: "asc" as const },
  },
} satisfies Prisma.IngredientInclude;

type UnitReference = {
  id: string;
  dimension: UnitDimension;
  factorToCanonical: string | null;
  isActive: boolean;
};

function text(
  value: string,
  field: string,
  maxLength: number,
): string {
  const result = value.trim();

  if (!result || result.length > maxLength) {
    throw new CatalogueError(
      `${field} must contain between 1 and ${maxLength} characters.`,
    );
  }

  return result;
}

function code(value: string, field: string, maxLength: number): string {
  const result = text(value, field, maxLength).toUpperCase();

  if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(result)) {
    throw new CatalogueError(
      `${field} may contain only letters, numbers, underscores and hyphens.`,
    );
  }

  return result;
}

function optionalText(
  value: string | null | undefined,
  field: string,
  maxLength: number,
): string | null | undefined {
  if (value === undefined || value === null) return value;

  const result = value.trim();

  if (result.length > maxLength) {
    throw new CatalogueError(`${field} cannot exceed ${maxLength} characters.`);
  }

  return result || null;
}

function sortOrder(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value < 0 || value > 1000000) {
    throw new CatalogueError("sortOrder must be a non-negative integer.");
  }

  return value;
}

function unitReference(unit: {
  id: string;
  dimension: UnitDimension;
  factorToCanonical: Prisma.Decimal | null;
  isActive: boolean;
}): UnitReference {
  return {
    id: unit.id,
    dimension: unit.dimension,
    factorToCanonical: unit.factorToCanonical?.toString() ?? null,
    isActive: unit.isActive,
  };
}

async function loadUnitReferences(
  tx: Prisma.TransactionClient,
  ids: string[],
): Promise<Map<string, UnitReference>> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  const units = await tx.unit.findMany({
    where: { id: { in: uniqueIds } },
  });

  if (units.length !== uniqueIds.length) {
    throw new CatalogueError("One or more selected units do not exist.", 400);
  }

  return new Map(units.map((unit) => [unit.id, unitReference(unit)]));
}

async function assertActiveCategory(
  tx: Prisma.TransactionClient,
  categoryId: string | null | undefined,
): Promise<void> {
  if (!categoryId) return;

  const category = await tx.ingredientCategory.findUnique({
    where: { id: categoryId },
    select: { id: true, isActive: true },
  });

  if (!category) {
    throw new CatalogueError("Ingredient category not found.", 404);
  }

  if (!category.isActive) {
    throw new CatalogueError("The selected ingredient category is inactive.");
  }
}

async function assertActiveInventoryCategory(
  tx: Prisma.TransactionClient,
  inventoryCategoryId: string | null | undefined,
): Promise<void> {
  if (!inventoryCategoryId) return;

  const category = await tx.inventoryCategory.findUnique({
    where: { id: inventoryCategoryId },
    select: { id: true, isActive: true },
  });

  if (!category) {
    throw new CatalogueError("Inventory purchasing category not found.", 404);
  }

  if (!category.isActive) {
    throw new CatalogueError("The selected inventory purchasing category is inactive.");
  }
}

function validateConversionInputs(
  conversions: ConversionInput[],
  baseUnit: UnitReference,
  units: Map<string, UnitReference>,
): void {
  const seen = new Set<string>();

  for (const conversion of conversions) {
    if (seen.has(conversion.unitId)) {
      throw new CatalogueError("A conversion unit can appear only once.");
    }

    seen.add(conversion.unitId);

    const conversionUnit = units.get(conversion.unitId);

    if (!conversionUnit) {
      throw new CatalogueError("Conversion unit not found.", 404);
    }

    assertValidIngredientConversion(
      baseUnit,
      conversionUnit,
      conversion.quantityInBaseUnit,
    );

    optionalText(conversion.notes, "Conversion notes", 255);
  }
}

export async function listUnits() {
  return prisma.unit.findMany({
    where: { isActive: true },
    orderBy: [{ dimension: "asc" }, { name: "asc" }],
  });
}

export async function listCategories(includeInactive = false) {
  return prisma.ingredientCategory.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { ingredients: true } },
    },
  });
}

export async function createCategory(input: CategoryInput) {
  return prisma.ingredientCategory.create({
    data: {
      code: code(input.code, "Category code", 40),
      name: text(input.name, "Category name", 100),
      description: optionalText(input.description, "Description", 10000),
      sortOrder: sortOrder(input.sortOrder) ?? 0,
    },
  });
}

export async function updateCategory(
  id: string,
  input: CategoryUpdateInput,
) {
  const data: Prisma.IngredientCategoryUpdateInput = {};

  if (input.code !== undefined) {
    data.code = code(input.code, "Category code", 40);
  }

  if (input.name !== undefined) {
    data.name = text(input.name, "Category name", 100);
  }

  if (input.description !== undefined) {
    data.description = optionalText(
      input.description,
      "Description",
      10000,
    );
  }

  if (input.sortOrder !== undefined) {
    data.sortOrder = sortOrder(input.sortOrder);
  }

  if (Object.keys(data).length === 0) {
    throw new CatalogueError("Provide at least one field to update.");
  }

  const existing = await prisma.ingredientCategory.findUnique({
    where: { id },
    select: { id: true, isActive: true },
  });

  if (!existing) throw new CatalogueError("Category not found.", 404);
  if (!existing.isActive) {
    throw new CatalogueError("Archived categories cannot be edited.", 409);
  }

  return prisma.ingredientCategory.update({ where: { id }, data });
}

export async function archiveCategory(id: string) {
  const existing = await prisma.ingredientCategory.findUnique({
    where: { id },
  });

  if (!existing) throw new CatalogueError("Category not found.", 404);

  return prisma.ingredientCategory.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function listAllergens(includeInactive = false) {
  return prisma.allergen.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { ingredients: true } },
    },
  });
}

export async function createAllergen(input: AllergenInput) {
  return prisma.allergen.create({
    data: {
      code: code(input.code, "Allergen code", 40),
      name: text(input.name, "Allergen name", 100),
    },
  });
}

export async function updateAllergen(
  id: string,
  input: AllergenUpdateInput,
) {
  const data: Prisma.AllergenUpdateInput = {};

  if (input.code !== undefined) {
    data.code = code(input.code, "Allergen code", 40);
  }

  if (input.name !== undefined) {
    data.name = text(input.name, "Allergen name", 100);
  }

  if (Object.keys(data).length === 0) {
    throw new CatalogueError("Provide at least one field to update.");
  }

  const existing = await prisma.allergen.findUnique({ where: { id } });

  if (!existing) throw new CatalogueError("Allergen not found.", 404);
  if (!existing.isActive) {
    throw new CatalogueError("Archived allergens cannot be edited.", 409);
  }

  return prisma.allergen.update({ where: { id }, data });
}

export async function archiveAllergen(id: string) {
  const existing = await prisma.allergen.findUnique({ where: { id } });

  if (!existing) throw new CatalogueError("Allergen not found.", 404);

  return prisma.allergen.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function listIngredients(filters?: {
  query?: string;
  categoryId?: string;
  includeInactive?: boolean;
}) {
  const query = filters?.query?.trim();

  const where: Prisma.IngredientWhereInput = {
    ...(filters?.includeInactive ? {} : { isActive: true }),
    ...(filters?.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { code: { contains: query, mode: "insensitive" } },
            { sku: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  return prisma.ingredient.findMany({
    where,
    take: 200,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: ingredientInclude,
  });
}

export async function getIngredient(id: string) {
  const ingredient = await prisma.ingredient.findUnique({
    where: { id },
    include: ingredientInclude,
  });

  if (!ingredient) throw new CatalogueError("Ingredient not found.", 404);

  return ingredient;
}

export async function createIngredient(input: CreateIngredientInput) {
  const normalizedCode = code(input.code, "Ingredient code", 64);
  const normalizedName = text(input.name, "Ingredient name", 160);
  const normalizedSku = optionalText(input.sku, "SKU", 80);
  const normalizedDescription = optionalText(
    input.description,
    "Description",
    10000,
  );
  const normalizedSortOrder = sortOrder(input.sortOrder) ?? 0;
  const conversions = input.conversions ?? [];

  return prisma.$transaction(async (tx) => {
    await assertActiveCategory(tx, input.categoryId);
    await assertActiveInventoryCategory(tx, input.inventoryCategoryId);

    const unitIds = [
      input.baseUnitId,
      ...(input.defaultPurchaseUnitId ? [input.defaultPurchaseUnitId] : []),
      ...conversions.map((item) => item.unitId),
    ];

    const units = await loadUnitReferences(tx, unitIds);
    const baseUnit = units.get(input.baseUnitId);

    if (!baseUnit) throw new CatalogueError("Base unit not found.", 404);

    assertValidBaseUnit(baseUnit);
    validateConversionInputs(conversions, baseUnit, units);

    const conversionIds = new Set(conversions.map((item) => item.unitId));

    if (input.defaultPurchaseUnitId) {
      const purchaseUnit = units.get(input.defaultPurchaseUnitId);

      if (!purchaseUnit) {
        throw new CatalogueError("Purchase unit not found.", 404);
      }

      assertPurchaseUnitCompatible(
        baseUnit,
        purchaseUnit,
        conversionIds,
      );
    }

    return tx.ingredient.create({
      data: {
        code: normalizedCode,
        sku: normalizedSku,
        name: normalizedName,
        description: normalizedDescription,
        isStockTracked: input.isStockTracked ?? true,
        sortOrder: normalizedSortOrder,
        baseUnit: { connect: { id: input.baseUnitId } },
        ...(input.categoryId
          ? { category: { connect: { id: input.categoryId } } }
          : {}),
        ...(input.inventoryCategoryId
          ? { inventoryCategory: { connect: { id: input.inventoryCategoryId } } }
          : {}),
        ...(input.defaultPurchaseUnitId
          ? {
              defaultPurchaseUnit: {
                connect: { id: input.defaultPurchaseUnitId },
              },
            }
          : {}),
        ...(conversions.length
          ? {
              unitConversions: {
                create: conversions.map((item) => ({
                  unit: { connect: { id: item.unitId } },
                  quantityInBaseUnit: item.quantityInBaseUnit,
                  isApproximate: item.isApproximate ?? false,
                  notes: optionalText(item.notes, "Conversion notes", 255),
                })),
              },
            }
          : {}),
      },
      include: ingredientInclude,
    });
  });
}

export async function updateIngredient(
  id: string,
  input: UpdateIngredientInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.ingredient.findUnique({
      where: { id },
      include: { unitConversions: true },
    });

    if (!existing) throw new CatalogueError("Ingredient not found.", 404);
    if (!existing.isActive) {
      throw new CatalogueError("Archived ingredients cannot be edited.", 409);
    }

    if (input.categoryId !== undefined) {
      await assertActiveCategory(tx, input.categoryId);
    }
    if (input.inventoryCategoryId !== undefined) {
      await assertActiveInventoryCategory(tx, input.inventoryCategoryId);
    }

    const nextBaseUnitId = input.baseUnitId ?? existing.baseUnitId;
    const nextPurchaseUnitId =
      input.defaultPurchaseUnitId === undefined
        ? existing.defaultPurchaseUnitId
        : input.defaultPurchaseUnitId;

    if (
      input.baseUnitId !== undefined &&
      input.baseUnitId !== existing.baseUnitId &&
      existing.unitConversions.length > 0
    ) {
      throw new CatalogueError(
        "Remove existing ingredient-specific conversions before changing the base unit.",
        409,
      );
    }

    const unitIds = [
      nextBaseUnitId,
      ...(nextPurchaseUnitId ? [nextPurchaseUnitId] : []),
      ...existing.unitConversions.map((item) => item.unitId),
    ];

    const units = await loadUnitReferences(tx, unitIds);
    const baseUnit = units.get(nextBaseUnitId);

    if (!baseUnit) throw new CatalogueError("Base unit not found.", 404);

    assertValidBaseUnit(baseUnit);

    for (const conversion of existing.unitConversions) {
      const conversionUnit = units.get(conversion.unitId);

      if (!conversionUnit) {
        throw new CatalogueError("Existing conversion unit not found.", 404);
      }

      assertValidIngredientConversion(
        baseUnit,
        conversionUnit,
        conversion.quantityInBaseUnit.toString(),
      );
    }

    if (nextPurchaseUnitId) {
      const purchaseUnit = units.get(nextPurchaseUnitId);

      if (!purchaseUnit) {
        throw new CatalogueError("Purchase unit not found.", 404);
      }

      assertPurchaseUnitCompatible(
        baseUnit,
        purchaseUnit,
        new Set(existing.unitConversions.map((item) => item.unitId)),
      );
    }

    const data: Prisma.IngredientUncheckedUpdateInput = {};

    if (input.code !== undefined) {
      data.code = code(input.code, "Ingredient code", 64);
    }

    if (input.sku !== undefined) {
      data.sku = optionalText(input.sku, "SKU", 80);
    }

    if (input.name !== undefined) {
      data.name = text(input.name, "Ingredient name", 160);
    }

    if (input.description !== undefined) {
      data.description = optionalText(input.description, "Description", 10000);
    }

    if (input.categoryId !== undefined) {
      data.categoryId = input.categoryId;
    }

    if (input.inventoryCategoryId !== undefined) {
      data.inventoryCategoryId = input.inventoryCategoryId;
    }

    if (input.baseUnitId !== undefined) {
      data.baseUnitId = input.baseUnitId;
    }

    if (input.defaultPurchaseUnitId !== undefined) {
      data.defaultPurchaseUnitId = input.defaultPurchaseUnitId;
    }

    if (input.isStockTracked !== undefined) {
      data.isStockTracked = input.isStockTracked;
    }

    if (input.sortOrder !== undefined) {
      data.sortOrder = sortOrder(input.sortOrder);
    }

    if (Object.keys(data).length === 0) {
      throw new CatalogueError("Provide at least one field to update.");
    }

    return tx.ingredient.update({
      where: { id },
      data,
      include: ingredientInclude,
    });
  });
}

export async function archiveIngredient(id: string) {
  const existing = await prisma.ingredient.findUnique({ where: { id } });

  if (!existing) throw new CatalogueError("Ingredient not found.", 404);

  return prisma.ingredient.update({
    where: { id },
    data: { isActive: false },
    include: ingredientInclude,
  });
}

export async function setIngredientConversion(
  ingredientId: string,
  unitId: string,
  input: {
    quantityInBaseUnit: string;
    isApproximate?: boolean;
    notes?: string | null;
  },
) {
  return prisma.$transaction(async (tx) => {
    const ingredient = await tx.ingredient.findUnique({
      where: { id: ingredientId },
      include: { baseUnit: true },
    });

    if (!ingredient) throw new CatalogueError("Ingredient not found.", 404);
    if (!ingredient.isActive) {
      throw new CatalogueError("Archived ingredients cannot be edited.", 409);
    }

    const conversionUnit = await tx.unit.findUnique({ where: { id: unitId } });

    if (!conversionUnit) {
      throw new CatalogueError("Conversion unit not found.", 404);
    }

    assertValidIngredientConversion(
      unitReference(ingredient.baseUnit),
      unitReference(conversionUnit),
      input.quantityInBaseUnit,
    );

    return tx.ingredientUnitConversion.upsert({
      where: {
        ingredientId_unitId: { ingredientId, unitId },
      },
      create: {
        ingredientId,
        unitId,
        quantityInBaseUnit: input.quantityInBaseUnit,
        isApproximate: input.isApproximate ?? false,
        notes: optionalText(input.notes, "Conversion notes", 255),
      },
      update: {
        quantityInBaseUnit: input.quantityInBaseUnit,
        ...(input.isApproximate !== undefined
          ? { isApproximate: input.isApproximate }
          : {}),
        ...(input.notes !== undefined
          ? { notes: optionalText(input.notes, "Conversion notes", 255) }
          : {}),
      },
    });
  });
}

export async function removeIngredientConversion(
  ingredientId: string,
  unitId: string,
) {
  return prisma.$transaction(async (tx) => {
    const ingredient = await tx.ingredient.findUnique({
      where: { id: ingredientId },
      select: { id: true, defaultPurchaseUnitId: true },
    });

    if (!ingredient) throw new CatalogueError("Ingredient not found.", 404);

    if (ingredient.defaultPurchaseUnitId === unitId) {
      throw new CatalogueError(
        "Change the default purchase unit before removing its conversion.",
        409,
      );
    }

    const result = await tx.ingredientUnitConversion.deleteMany({
      where: { ingredientId, unitId },
    });

    if (result.count === 0) {
      throw new CatalogueError("Ingredient conversion not found.", 404);
    }

    return { removed: true };
  });
}

export async function setIngredientAllergen(
  ingredientId: string,
  allergenId: string,
  input: {
    presence: AllergenPresence;
    notes?: string | null;
  },
) {
  return prisma.$transaction(async (tx) => {
    const [ingredient, allergen] = await Promise.all([
      tx.ingredient.findUnique({
        where: { id: ingredientId },
        select: { id: true, isActive: true },
      }),
      tx.allergen.findUnique({
        where: { id: allergenId },
        select: { id: true, isActive: true },
      }),
    ]);

    if (!ingredient) throw new CatalogueError("Ingredient not found.", 404);
    if (!allergen) throw new CatalogueError("Allergen not found.", 404);
    if (!ingredient.isActive || !allergen.isActive) {
      throw new CatalogueError(
        "Archived ingredients or allergens cannot be edited.",
        409,
      );
    }

    return tx.ingredientAllergen.upsert({
      where: {
        ingredientId_allergenId: { ingredientId, allergenId },
      },
      create: {
        ingredientId,
        allergenId,
        presence: input.presence,
        notes: optionalText(input.notes, "Allergen notes", 255),
      },
      update: {
        presence: input.presence,
        notes: optionalText(input.notes, "Allergen notes", 255),
      },
    });
  });
}

export async function removeIngredientAllergen(
  ingredientId: string,
  allergenId: string,
) {
  const result = await prisma.ingredientAllergen.deleteMany({
    where: { ingredientId, allergenId },
  });

  if (result.count === 0) {
    throw new CatalogueError("Ingredient allergen association not found.", 404);
  }

  return { removed: true };
}

export function isAllergenPresence(
  value: unknown,
): value is AllergenPresence {
  return (
    typeof value === "string" &&
    Object.values(AllergenPresence).includes(value as AllergenPresence)
  );
}
