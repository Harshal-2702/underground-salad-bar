import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { isDateKey } from "./india-date.js";

export class LeftoverInventoryError extends Error {
  constructor(message: string, public readonly statusCode: 400 | 404 | 409 = 400) {
    super(message);
    this.name = "LeftoverInventoryError";
  }
}

type CleanLine = { ingredientId: string; quantity: Prisma.Decimal; sortOrder: number };

function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw new LeftoverInventoryError(`${field} must contain between 1 and ${maxLength} characters.`);
  }
  return value.trim();
}

function stocktakeDate(value: unknown): Date {
  if (!isDateKey(value)) throw new LeftoverInventoryError("Stocktake date must use YYYY-MM-DD format.");
  return new Date(`${value}T00:00:00.000Z`);
}

function nonNegativeQuantity(value: unknown): Prisma.Decimal {
  if (typeof value !== "string" || !/^(?:0|[1-9]\\d{0,11})(?:\\.\\d{1,6})?$/.test(value.trim())) {
    throw new LeftoverInventoryError("Leftover quantity must be zero or greater, with up to 6 decimal places.");
  }
  const quantity = new Prisma.Decimal(value.trim());
  if (!quantity.isFinite() || quantity.isNegative()) {
    throw new LeftoverInventoryError("Leftover quantity must be zero or greater.");
  }
  return quantity;
}

function parseLines(value: unknown): CleanLine[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 1000) {
    throw new LeftoverInventoryError("Record at least one leftover quantity (maximum 1,000 ingredients).");
  }

  const seen = new Set<string>();
  return value.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new LeftoverInventoryError(`Leftover row ${index + 1} is invalid.`);
    }
    const row = raw as Record<string, unknown>;
    const ingredientId = requiredText(row.ingredientId, "Ingredient", 128);
    if (seen.has(ingredientId)) {
      throw new LeftoverInventoryError("An ingredient can only be recorded once per stocktake.");
    }
    seen.add(ingredientId);
    return {
      ingredientId,
      quantity: nonNegativeQuantity(row.quantity),
      sortOrder: index,
    };
  });
}

export async function submitLeftoverInventory(
  recordedByEmail: string,
  value: unknown,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LeftoverInventoryError("Stocktake submission must be a JSON object.");
  }
  const input = value as Record<string, unknown>;
  const recordedByName = requiredText(input.recordedByName, "Person recording", 120);
  const date = stocktakeDate(input.stocktakeDate);
  const lines = parseLines(input.lines);

  return prisma.$transaction(async (tx) => {
    const ingredientIds = lines.map((line) => line.ingredientId);
    const ingredients = await tx.ingredient.findMany({
      where: { id: { in: ingredientIds }, isActive: true },
      include: { inventoryCategory: true, baseUnit: true },
    });
    const ingredientMap = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));

    if (ingredientMap.size !== ingredientIds.length) {
      throw new LeftoverInventoryError("One or more selected ingredients are missing or inactive.", 409);
    }

    const snapshots = lines.map((line) => {
      const ingredient = ingredientMap.get(line.ingredientId)!;
      if (!ingredient.inventoryCategory || !ingredient.inventoryCategory.isActive) {
        throw new LeftoverInventoryError(
          `${ingredient.name} must be assigned to an active inventory purchasing category before its leftover can be recorded.`,
          409,
        );
      }
      if (!ingredient.baseUnit.isActive) {
        throw new LeftoverInventoryError(`${ingredient.name} has an inactive base unit.`, 409);
      }
      return {
        ingredientId: ingredient.id,
        inventoryCategoryId: ingredient.inventoryCategory.id,
        baseUnitId: ingredient.baseUnit.id,
        inventoryCategoryCodeSnapshot: ingredient.inventoryCategory.code,
        inventoryCategoryNameSnapshot: ingredient.inventoryCategory.name,
        ingredientCodeSnapshot: ingredient.code,
        ingredientNameSnapshot: ingredient.name,
        baseUnitCodeSnapshot: ingredient.baseUnit.code,
        baseUnitNameSnapshot: ingredient.baseUnit.name,
        baseUnitSymbolSnapshot: ingredient.baseUnit.symbol,
        quantity: line.quantity,
        sortOrder: line.sortOrder,
      };
    });

    return tx.leftoverInventoryTransaction.create({
      data: {
        recordedByEmail: recordedByEmail.trim().toLowerCase(),
        recordedByName,
        stocktakeDate: date,
        lines: { create: snapshots },
      },
      include: {
        lines: {
          orderBy: [{ inventoryCategoryNameSnapshot: "asc" }, { sortOrder: "asc" }],
        },
      },
    });
  });
}

export interface LeftoverHistoryFilters {
  from?: string;
  to?: string;
  categoryId?: string;
  recordedBy?: string;
  page?: number;
  pageSize?: number;
}

export async function listLeftoverInventory(filters: LeftoverHistoryFilters = {}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 10;
  if (!Number.isInteger(page) || page < 1 || page > 100000) {
    throw new LeftoverInventoryError("Page is invalid.");
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new LeftoverInventoryError("Page size must be between 1 and 100.");
  }

  const from = filters.from ? stocktakeDate(filters.from) : undefined;
  const to = filters.to ? stocktakeDate(filters.to) : undefined;
  if (from && to && from > to) {
    throw new LeftoverInventoryError("Start date cannot be after end date.");
  }

  const lineWhere: Prisma.LeftoverInventoryLineWhereInput = {};
  if (filters.categoryId) lineWhere.inventoryCategoryId = filters.categoryId;

  const where: Prisma.LeftoverInventoryTransactionWhereInput = {
    ...(from || to ? {
      stocktakeDate: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      },
    } : {}),
    ...(filters.recordedBy?.trim() ? {
      OR: [
        { recordedByName: { contains: filters.recordedBy.trim(), mode: "insensitive" } },
        { recordedByEmail: { contains: filters.recordedBy.trim(), mode: "insensitive" } },
      ],
    } : {}),
    ...(filters.categoryId ? { lines: { some: lineWhere } } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.leftoverInventoryTransaction.count({ where }),
    prisma.leftoverInventoryTransaction.findMany({
      where,
      orderBy: [{ stocktakeDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: { select: { lines: true } },
        lines: {
          select: {
            inventoryCategoryId: true,
            inventoryCategoryNameSnapshot: true,
          },
          orderBy: { inventoryCategoryNameSnapshot: "asc" },
        },
      },
    }),
  ]);

  return {
    items: items.map((item) => ({
      ...item,
      categories: [...new Map(item.lines.map((line) => [line.inventoryCategoryId, {
        id: line.inventoryCategoryId,
        name: line.inventoryCategoryNameSnapshot,
      }])).values()],
      lines: undefined,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getLeftoverInventoryTransaction(id: string) {
  const transaction = await prisma.leftoverInventoryTransaction.findUnique({
    where: { id },
    include: {
      lines: {
        orderBy: [{ inventoryCategoryNameSnapshot: "asc" }, { sortOrder: "asc" }],
      },
    },
  });
  if (!transaction) throw new LeftoverInventoryError("Stocktake transaction not found.", 404);
  return transaction;
}
