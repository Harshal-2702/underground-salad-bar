import { PrismaClient, UnitDimension } from "@prisma/client";

const prisma = new PrismaClient();

const categories = [
  { code: "BASE", name: "Base", sortOrder: 1 },
  { code: "PROTEIN", name: "Protein", sortOrder: 2 },
  { code: "VEGETABLE", name: "Vegetables", sortOrder: 3 },
  { code: "BEAN", name: "Beans", sortOrder: 4 },
  { code: "DRESSING", name: "Dressing", sortOrder: 5 },
] as const;

const ingredients = [
  // Base
  { code: "RICE", name: "Rice", category: "BASE", unit: "unit_g", sort: 1 },
  { code: "WRAP", name: "Wrap", category: "BASE", unit: "unit_each", sort: 2 },

  // Protein
  { code: "CHICKEN", name: "Chicken", category: "PROTEIN", unit: "unit_g", sort: 1 },
  { code: "PANEER", name: "Paneer", category: "PROTEIN", unit: "unit_g", sort: 2 },
  { code: "SOYA_CHUNKS", name: "Soya Chunks", category: "PROTEIN", unit: "unit_g", sort: 3 },

  // Vegetables
  { code: "CARROT", name: "Carrot", category: "VEGETABLE", unit: "unit_g", sort: 1 },
  { code: "BEETROOT", name: "Beetroot", category: "VEGETABLE", unit: "unit_g", sort: 2 },
  { code: "BABY_POTATO", name: "Baby Potato", category: "VEGETABLE", unit: "unit_g", sort: 3 },
  { code: "BROCCOLI", name: "Broccoli", category: "VEGETABLE", unit: "unit_g", sort: 4 },
  { code: "BELL_PEPPER", name: "Bell Pepper", category: "VEGETABLE", unit: "unit_g", sort: 5 },
  { code: "LETTUCE", name: "Lettuce", category: "VEGETABLE", unit: "unit_g", sort: 6 },
  { code: "ONION", name: "Onion", category: "VEGETABLE", unit: "unit_g", sort: 7 },
  { code: "CORN", name: "Corn", category: "VEGETABLE", unit: "unit_g", sort: 8 },

  // Beans
  { code: "CHICKPEAS", name: "Chickpeas", category: "BEAN", unit: "unit_g", sort: 1 },
  { code: "KIDNEY_BEANS", name: "Kidney Beans", category: "BEAN", unit: "unit_g", sort: 2 },

  // Dressings — G is a provisional base measurement.
  { code: "MAKHNI_DRESSING", name: "Makhni", category: "DRESSING", unit: "unit_g", sort: 1 },
  { code: "SPINACH_DRESSING", name: "Spinach", category: "DRESSING", unit: "unit_g", sort: 2 },
  { code: "HUNG_CURD_GARLIC", name: "Hung Curd Garlic", category: "DRESSING", unit: "unit_g", sort: 3 },
  { code: "PESTO_DRESSING", name: "Pesto", category: "DRESSING", unit: "unit_g", sort: 4 },
  { code: "PAPRIKA_DRESSING", name: "Paprika", category: "DRESSING", unit: "unit_g", sort: 5 },
  { code: "CHIPOTLE_DRESSING", name: "Chipotle", category: "DRESSING", unit: "unit_g", sort: 6 },
] as const;

async function main() {
  // This seed is deliberately restricted to the disposable local database.
  const rawUrl = process.env.DATABASE_URL;

  if (!rawUrl) throw new Error("DATABASE_URL is required.");

  const url = new URL(rawUrl);

  if (
    url.hostname !== "127.0.0.1" ||
    url.port !== "55432" ||
    url.pathname !== "/ukos_migration_test_20261105"
  ) {
    throw new Error(
      "Safety stop: catalogue seed is restricted to local ukos_migration_test_20261105.",
    );
  }

  const requiredUnits = await prisma.unit.findMany({
    where: { id: { in: ["unit_g", "unit_each"] } },
  });

  const gram = requiredUnits.find((unit) => unit.id === "unit_g");
  const each = requiredUnits.find((unit) => unit.id === "unit_each");

  if (
    !gram ||
    !each ||
    gram.dimension !== UnitDimension.MASS ||
    each.dimension !== UnitDimension.COUNT ||
    !gram.isActive ||
    !each.isActive
  ) {
    throw new Error("Required active G and EACH units are missing or invalid.");
  }

  const summary = await prisma.$transaction(async (tx) => {
    const categoryIds: Record<string, string> = {};

    for (const category of categories) {
      const row = await tx.ingredientCategory.upsert({
        where: { code: category.code },
        create: {
          code: category.code,
          name: category.name,
          sortOrder: category.sortOrder,
          isActive: true,
        },
        // Preserve any later manual edits or archive decisions on reruns.
        update: {},
      });

      categoryIds[category.code] = row.id;
    }

    let created = 0;
    let existing = 0;

    for (const item of ingredients) {
      const categoryId = categoryIds[item.category];

      if (!categoryId) {
        throw new Error(`Missing category ${item.category}.`);
      }

      const unitId = item.unit === "unit_each" ? each.id : gram.id;

      const previous = await tx.ingredient.findUnique({
        where: { code: item.code },
        select: { id: true },
      });

      const row = await tx.ingredient.upsert({
        where: { code: item.code },
        create: {
          code: item.code,
          name: item.name,
          category: { connect: { id: categoryId } },
          baseUnit: { connect: { id: unitId } },
          isStockTracked: true,
          sortOrder: item.sort,
          isActive: true,
        },
        update: {},
      });

      if (
        row.categoryId !== categoryId ||
        row.baseUnitId !== unitId
      ) {
        throw new Error(
          `Existing ingredient ${item.code} has a different category or base unit. Manual review required.`,
        );
      }

      if (previous) existing++;
      else created++;
    }

    const total = await tx.ingredient.count({
      where: { code: { in: ingredients.map((item) => item.code) } },
    });

    if (total !== ingredients.length) {
      throw new Error(`Expected ${ingredients.length} ingredients; found ${total}.`);
    }

    return { created, existing, total };
  });

  console.log("Catalogue seed completed.");
  console.log(`Categories: ${categories.length}`);
  console.log(`Ingredients created: ${summary.created}`);
  console.log(`Ingredients already present: ${summary.existing}`);
  console.log(`Total expected ingredients: ${summary.total}`);
  console.log("Purchase units and ingredient-specific conversions: not assigned.");
  console.log("Stock quantities, prices, recipes and allergens: not assigned.");
}

main()
  .catch((error: unknown) => {
    console.error("Catalogue seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
