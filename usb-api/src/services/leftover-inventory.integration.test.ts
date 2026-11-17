import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/prisma.js";
import {
  getLeftoverInventoryTransaction,
  listLeftoverInventory,
  LeftoverInventoryError,
  submitLeftoverInventory,
} from "./leftover-inventory.service.js";

// Fail closed: tests may only use the disposable CI PostgreSQL database.
const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) throw new Error("DATABASE_URL is required.");
const dbUrl = new URL(rawUrl);
if (
  dbUrl.hostname !== "127.0.0.1" ||
  dbUrl.port !== "55432" ||
  !["/ukos_migration_test_20261105", "/ukos_test"].includes(dbUrl.pathname)
) {
  throw new Error("Leftover inventory integration tests are restricted to approved disposable local databases.");
}

test("leftover stocktake validates base units, saves zero, filters history and preserves snapshots", async () => {
  const suffix = Date.now().toString();
  const code = `IT_LEFTOVER_${suffix}`;
  let categoryId: string | undefined;
  let ingredientId: string | undefined;
  let countIngredientId: string | undefined;
  let transactionId: string | undefined;

  try {
    const category = await prisma.inventoryCategory.create({
      data: { code: `ITL_${suffix}`, name: "Leftover test category" },
    });
    categoryId = category.id;
    const ingredient = await prisma.ingredient.create({
      data: {
        code,
        name: "Leftover test ingredient",
        inventoryCategoryId: category.id,
        baseUnitId: "unit_g",
      },
    });
    ingredientId = ingredient.id;
    const countIngredient = await prisma.ingredient.create({
      data: {
        code: `IT_LEFTOVER_EACH_${suffix}`,
        name: "Leftover test count ingredient",
        inventoryCategoryId: category.id,
        baseUnitId: "unit_each",
      },
    });
    countIngredientId = countIngredient.id;

    await assert.rejects(
      submitLeftoverInventory("test@example.invalid", {
        recordedByName: "Test Staff",
        stocktakeDate: "2026-11-17",
        lines: [{ ingredientId: ingredient.id, quantity: "-1" }],
      }),
      (error: unknown) => error instanceof LeftoverInventoryError && /zero or greater/.test(error.message),
    );

    const transaction = await submitLeftoverInventory("test@example.invalid", {
      recordedByName: "Test Staff",
      stocktakeDate: "2026-11-17",
      lines: [
        { ingredientId: ingredient.id, quantity: "0" },
        { ingredientId: countIngredient.id, quantity: "1.5" },
      ],
    });
    transactionId = transaction.id;

    assert.equal(transaction.lines.length, 2);
    const gramLine = transaction.lines.find((line) => line.ingredientId === ingredient.id);
    const eachLine = transaction.lines.find((line) => line.ingredientId === countIngredient.id);
    assert.equal(gramLine?.quantity.toString(), "0");
    assert.equal(gramLine?.baseUnitCodeSnapshot, "G");
    assert.equal(gramLine?.baseUnitSymbolSnapshot, "g");
    assert.equal(eachLine?.quantity.toString(), "1.5");
    assert.equal(eachLine?.baseUnitCodeSnapshot, "EACH");
    assert.equal(eachLine?.baseUnitSymbolSnapshot, "each");

    const history = await listLeftoverInventory({
      from: "2026-11-17",
      to: "2026-11-17",
      categoryId: category.id,
      recordedBy: "Test Staff",
    });
    assert.ok(history.items.some((item) => item.id === transaction.id));

    const detail = await getLeftoverInventoryTransaction(transaction.id);
    assert.equal(detail.lines.find((line) => line.ingredientId === ingredient.id)?.ingredientNameSnapshot, "Leftover test ingredient");

    await prisma.ingredient.update({ where: { id: ingredient.id }, data: { name: "Renamed after stocktake" } });
    const preserved = await getLeftoverInventoryTransaction(transaction.id);
    assert.equal(preserved.lines.find((line) => line.ingredientId === ingredient.id)?.ingredientNameSnapshot, "Leftover test ingredient");
  } finally {
    await prisma.$transaction(async (tx) => {
      if (transactionId) {
        await tx.leftoverInventoryLine.deleteMany({ where: { transactionId } });
        await tx.leftoverInventoryTransaction.deleteMany({ where: { id: transactionId } });
      }
      if (ingredientId) await tx.ingredient.deleteMany({ where: { id: ingredientId } });
      if (countIngredientId) await tx.ingredient.deleteMany({ where: { id: countIngredientId } });
      if (categoryId) await tx.inventoryCategory.deleteMany({ where: { id: categoryId } });
    });
    await prisma.$disconnect();
  }
});
