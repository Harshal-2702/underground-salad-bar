import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getIndiaBusinessDate, isDateKey } from "./india-date.js";
import { assertPurchaseUnitCompatible, IngredientValidationError } from "./ingredient-validation.js";

export class PurchaseError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
    this.name = "PurchaseError";
  }
}

type JsonRecord = Record<string, unknown>;
type CleanLine = {
  ingredientId: string;
  purchaseUnitId: string;
  quantity: Prisma.Decimal;
  itemAmount: Prisma.Decimal;
  sortOrder: number;
};
type CleanSheet = {
  inventoryCategoryId: string;
  purchaseDate: Date;
  supplierName: string;
  invoiceNumber: string | null;
  lines: CleanLine[];
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw new PurchaseError(`${field} must contain between 1 and ${maxLength} characters.`);
  }
  return value.trim();
}

function optionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.trim().length > maxLength) {
    throw new PurchaseError(`${field} must be ${maxLength} characters or fewer.`);
  }
  return value.trim() || null;
}

function requiredId(value: unknown, field: string): string {
  return requiredText(value, field, 128);
}

function purchaseQuantity(value: unknown): Prisma.Decimal {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(value.trim())) {
    throw new PurchaseError("Quantity must be a positive number with up to 6 decimal places.");
  }
  const result = new Prisma.Decimal(value.trim());
  if (!result.isFinite() || !result.greaterThan(0)) {
    throw new PurchaseError("Quantity must be greater than zero.");
  }
  return result;
}

function itemAmount(value: unknown): Prisma.Decimal {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(value.trim())) {
    throw new PurchaseError("Item amount must be a positive amount with up to 2 decimal places.");
  }
  const result = new Prisma.Decimal(value.trim());
  if (!result.isFinite() || !result.greaterThan(0)) {
    throw new PurchaseError("Item amount must be greater than zero.");
  }
  return result;
}

function purchaseDate(value: unknown): Date {
  if (!isDateKey(value)) {
    throw new PurchaseError("Purchase date must use YYYY-MM-DD format.");
  }
  return new Date(`${value}T00:00:00.000Z`);
}

function parseSubmission(value: unknown): { recordedByName: string; sheets: CleanSheet[] } {
  if (!isRecord(value) || !Array.isArray(value.sheets)) {
    throw new PurchaseError("Purchase submission must contain category sheets.");
  }
  const recordedByName = requiredText(value.recordedByName, "Person recording", 120);
  if (value.sheets.length < 1 || value.sheets.length > 20) {
    throw new PurchaseError("Submit between 1 and 20 completed category sheets.");
  }

  const seenCategories = new Set<string>();
  let totalLines = 0;

  const sheets = value.sheets.map((rawSheet, sheetIndex): CleanSheet => {
    if (!isRecord(rawSheet)) throw new PurchaseError(`Category sheet ${sheetIndex + 1} is invalid.`);
    const inventoryCategoryId = requiredId(rawSheet.inventoryCategoryId, "Inventory category");
    if (seenCategories.has(inventoryCategoryId)) {
      throw new PurchaseError("Only one sheet per purchasing category can be submitted in a transaction.");
    }
    seenCategories.add(inventoryCategoryId);

    if (!Array.isArray(rawSheet.lines) || rawSheet.lines.length < 1 || rawSheet.lines.length > 200) {
      throw new PurchaseError("Each completed sheet must contain between 1 and 200 ingredient rows.");
    }
    totalLines += rawSheet.lines.length;
    if (totalLines > 500) throw new PurchaseError("A transaction cannot contain more than 500 ingredient rows.");

    const lines = rawSheet.lines.map((rawLine, lineIndex): CleanLine => {
      if (!isRecord(rawLine)) throw new PurchaseError(`Ingredient row ${lineIndex + 1} is invalid.`);
      return {
        ingredientId: requiredId(rawLine.ingredientId, "Ingredient"),
        purchaseUnitId: requiredId(rawLine.purchaseUnitId, "Purchase unit"),
        quantity: purchaseQuantity(rawLine.quantity),
        itemAmount: itemAmount(rawLine.itemAmount),
        sortOrder: lineIndex,
      };
    });

    return {
      inventoryCategoryId,
      purchaseDate: purchaseDate(rawSheet.purchaseDate),
      supplierName: requiredText(rawSheet.supplierName, "Supplier", 160),
      invoiceNumber: optionalText(rawSheet.invoiceNumber, "Invoice number", 120),
      lines,
    };
  });

  return { recordedByName, sheets };
}

function validateDraftData(value: unknown): Prisma.InputJsonValue {
  if (!isRecord(value) || !Array.isArray(value.sheets) || value.sheets.length > 20) {
    throw new PurchaseError("Draft data is invalid.");
  }

  const serialized = JSON.stringify(value);
  if (serialized.length > 500_000) {
    throw new PurchaseError("Draft is too large. Reduce the number of rows before saving.");
  }

  if (value.recordedByName !== undefined && (typeof value.recordedByName !== "string" || value.recordedByName.length > 120)) {
    throw new PurchaseError("Person recording must be 120 characters or fewer.");
  }

  for (const [index, rawSheet] of value.sheets.entries()) {
    if (!isRecord(rawSheet) || !Array.isArray(rawSheet.lines) || rawSheet.lines.length > 200) {
      throw new PurchaseError(`Draft category sheet ${index + 1} is invalid.`);
    }
    for (const rawLine of rawSheet.lines) {
      if (!isRecord(rawLine)) throw new PurchaseError("Draft ingredient row is invalid.");
      for (const key of ["rowKey", "ingredientId", "ingredientInput", "purchaseUnitId", "quantity", "itemAmount"]) {
        const field = rawLine[key];
        if (field !== undefined && field !== null && (typeof field !== "string" || field.length > 500)) {
          throw new PurchaseError(`Draft field ${key} is invalid.`);
        }
      }
    }
  }

  return JSON.parse(serialized) as Prisma.InputJsonValue;
}

export async function getPurchaseDraft(ownerEmail: string) {
  const draft = await prisma.purchaseDraft.findUnique({
    where: { ownerEmail },
    select: { data: true, updatedAt: true },
  });
  return {
    data: draft?.data ?? { recordedByName: "", sheets: [] },
    updatedAt: draft?.updatedAt ?? null,
  };
}

export async function savePurchaseDraft(ownerEmail: string, value: unknown) {
  const data = validateDraftData(value);
  const draft = await prisma.purchaseDraft.upsert({
    where: { ownerEmail },
    create: { ownerEmail, createdByEmail: ownerEmail, updatedByEmail: ownerEmail, data },
    update: { updatedByEmail: ownerEmail, data },
    select: { updatedAt: true },
  });
  return { saved: true, updatedAt: draft.updatedAt };
}

async function allocatePurchaseReference(
  tx: Prisma.TransactionClient,
  businessDate: string,
): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ lastSequence: number }>>(Prisma.sql`
    INSERT INTO "PurchaseDailySequence" ("businessDate", "lastSequence", "updatedAt")
    VALUES (${businessDate}::date, 1, CURRENT_TIMESTAMP)
    ON CONFLICT ("businessDate")
    DO UPDATE SET
      "lastSequence" = "PurchaseDailySequence"."lastSequence" + 1,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "lastSequence"
  `);

  const sequence = rows[0]?.lastSequence;
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error("Unable to allocate a purchase reference.");
  }
  return `PUR-${businessDate.replaceAll("-", "")}-${String(sequence).padStart(4, "0")}`;
}

export async function submitPurchase(ownerEmail: string, value: unknown) {
  const { recordedByName, sheets } = parseSubmission(value);

  return prisma.$transaction(async (tx) => {
    const categoryIds = sheets.map((sheet) => sheet.inventoryCategoryId);
    const categories = await tx.inventoryCategory.findMany({
      where: { id: { in: categoryIds }, isActive: true },
    });
    const categoryMap = new Map(categories.map((category) => [category.id, category]));
    if (categoryMap.size !== categoryIds.length) {
      throw new PurchaseError("One or more purchasing categories are missing or inactive.", 409);
    }

    const ingredientIds = [...new Set(sheets.flatMap((sheet) => sheet.lines.map((line) => line.ingredientId)))];
    const unitIds = [...new Set(sheets.flatMap((sheet) => sheet.lines.map((line) => line.purchaseUnitId)))];

    const [ingredients, units] = await Promise.all([
      tx.ingredient.findMany({
        where: { id: { in: ingredientIds } },
        include: {
          baseUnit: true,
          unitConversions: { select: { unitId: true } },
        },
      }),
      tx.unit.findMany({ where: { id: { in: unitIds } } }),
    ]);
    const ingredientMap = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
    const unitMap = new Map(units.map((unit) => [unit.id, unit]));

    let totalAmount = new Prisma.Decimal(0);
    const nestedSheets = sheets.map((sheet) => {
      const category = categoryMap.get(sheet.inventoryCategoryId)!;
      const nestedLines = sheet.lines.map((line) => {
        const ingredient = ingredientMap.get(line.ingredientId);
        const unit = unitMap.get(line.purchaseUnitId);

        if (!ingredient) throw new PurchaseError("An ingredient in this purchase no longer exists.", 404);
        if (!ingredient.isActive) throw new PurchaseError(`${ingredient.name} is inactive and cannot be purchased.`, 409);
        if (ingredient.inventoryCategoryId !== sheet.inventoryCategoryId) {
          throw new PurchaseError(`${ingredient.name} is not assigned to the selected purchasing category.`, 409);
        }
        if (!unit) throw new PurchaseError("A selected purchase unit no longer exists.", 404);
        if (!unit.isActive) throw new PurchaseError(`${unit.name} is inactive and cannot be used.`, 409);
        try {
          assertPurchaseUnitCompatible(
            {
              id: ingredient.baseUnit.id,
              dimension: ingredient.baseUnit.dimension,
              factorToCanonical: ingredient.baseUnit.factorToCanonical?.toString() ?? null,
              isActive: ingredient.baseUnit.isActive,
            },
            {
              id: unit.id,
              dimension: unit.dimension,
              factorToCanonical: unit.factorToCanonical?.toString() ?? null,
              isActive: unit.isActive,
            },
            new Set(ingredient.unitConversions.map((conversion) => conversion.unitId)),
          );
        } catch (error) {
          if (error instanceof IngredientValidationError) {
            throw new PurchaseError(`${ingredient.name}: ${error.message}`, 409);
          }
          throw error;
        }

        totalAmount = totalAmount.plus(line.itemAmount);
        return {
          ingredientId: ingredient.id,
          purchaseUnitId: unit.id,
          ingredientCodeSnapshot: ingredient.code,
          ingredientNameSnapshot: ingredient.name,
          purchaseUnitCodeSnapshot: unit.code,
          purchaseUnitNameSnapshot: unit.name,
          purchaseUnitSymbolSnapshot: unit.symbol,
          quantity: line.quantity,
          itemAmount: line.itemAmount,
          sortOrder: line.sortOrder,
        };
      });

      return {
        inventoryCategoryId: category.id,
        inventoryCategoryCodeSnapshot: category.code,
        inventoryCategoryNameSnapshot: category.name,
        purchaseDate: sheet.purchaseDate,
        supplierName: sheet.supplierName,
        invoiceNumber: sheet.invoiceNumber,
        lines: { create: nestedLines },
      };
    });

    const maximumTransactionAmount = new Prisma.Decimal("9999999999999999.99");
    if (totalAmount.greaterThan(maximumTransactionAmount)) {
      throw new PurchaseError("Transaction total exceeds the supported amount limit.");
    }

    const reference = await allocatePurchaseReference(tx, getIndiaBusinessDate());
    const transaction = await tx.purchaseTransaction.create({
      data: {
        reference,
        recordedByEmail: ownerEmail,
        recordedByName,
        totalAmount,
        sheets: { create: nestedSheets },
      },
      include: {
        sheets: {
          orderBy: [{ purchaseDate: "asc" }, { inventoryCategoryNameSnapshot: "asc" }],
          include: { lines: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
        },
      },
    });

    await tx.purchaseDraft.deleteMany({ where: { ownerEmail } });
    return transaction;
  });
}

export interface PurchaseHistoryFilters {
  from?: string;
  to?: string;
  categoryId?: string;
  supplier?: string;
  ingredient?: string;
  invoice?: string;
  recordedBy?: string;
  reference?: string;
  minAmount?: string;
  maxAmount?: string;
  sortBy?: "createdAt" | "reference" | "totalAmount";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

function filterDate(value: string | undefined, field: string): Date | undefined {
  if (!value) return undefined;
  if (!isDateKey(value)) throw new PurchaseError(`${field} must use YYYY-MM-DD format.`);
  return new Date(`${value}T00:00:00.000Z`);
}

function filterAmount(value: string | undefined, field: string): Prisma.Decimal | undefined {
  if (!value) return undefined;
  if (!/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(value.trim())) {
    throw new PurchaseError(`${field} must be a non-negative amount with up to 2 decimal places.`);
  }
  return new Prisma.Decimal(value.trim());
}

export async function listPurchaseHistory(filters: PurchaseHistoryFilters) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  if (!Number.isInteger(page) || page < 1 || page > 100000) throw new PurchaseError("Page is invalid.");
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new PurchaseError("Page size must be between 1 and 100.");

  const from = filterDate(filters.from, "Start date");
  const to = filterDate(filters.to, "End date");
  if (from && to && from > to) throw new PurchaseError("Start date cannot be after end date.");

  const sheetWhere: Prisma.PurchaseSheetWhereInput = {};
  if (filters.categoryId) sheetWhere.inventoryCategoryId = filters.categoryId;
  if (filters.supplier?.trim()) sheetWhere.supplierName = { contains: filters.supplier.trim(), mode: "insensitive" };
  if (filters.invoice?.trim()) sheetWhere.invoiceNumber = { contains: filters.invoice.trim(), mode: "insensitive" };
  if (from || to) {
    sheetWhere.purchaseDate = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lt: new Date(to.getTime() + 24 * 60 * 60 * 1000) } : {}),
    };
  }
  if (filters.ingredient?.trim()) {
    const query = filters.ingredient.trim();
    sheetWhere.lines = {
      some: {
        OR: [
          { ingredientNameSnapshot: { contains: query, mode: "insensitive" } },
          { ingredientCodeSnapshot: { contains: query, mode: "insensitive" } },
        ],
      },
    };
  }

  const where: Prisma.PurchaseTransactionWhereInput = {
    ...(Object.keys(sheetWhere).length ? { sheets: { some: sheetWhere } } : {}),
    ...(filters.recordedBy?.trim() ? {
      OR: [
        { recordedByName: { contains: filters.recordedBy.trim(), mode: "insensitive" } },
        { recordedByEmail: { contains: filters.recordedBy.trim(), mode: "insensitive" } },
      ],
    } : {}),
    ...(filters.reference?.trim() ? { reference: { contains: filters.reference.trim(), mode: "insensitive" } } : {}),
  };

  const minAmount = filterAmount(filters.minAmount, "Minimum amount");
  const maxAmount = filterAmount(filters.maxAmount, "Maximum amount");
  if (minAmount && maxAmount && minAmount.greaterThan(maxAmount)) {
    throw new PurchaseError("Minimum amount cannot exceed maximum amount.");
  }
  if (minAmount || maxAmount) {
    where.totalAmount = {
      ...(minAmount ? { gte: minAmount } : {}),
      ...(maxAmount ? { lte: maxAmount } : {}),
    };
  }

  const sortBy = filters.sortBy ?? "createdAt";
  const sortOrder = filters.sortOrder ?? "desc";
  const orderBy = sortBy === "reference"
    ? { reference: sortOrder }
    : sortBy === "totalAmount"
      ? { totalAmount: sortOrder }
      : { createdAt: sortOrder };

  const [total, items] = await Promise.all([
    prisma.purchaseTransaction.count({ where }),
    prisma.purchaseTransaction.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        sheets: {
          orderBy: [{ purchaseDate: "asc" }, { inventoryCategoryNameSnapshot: "asc" }],
          select: {
            id: true,
            inventoryCategoryCodeSnapshot: true,
            inventoryCategoryNameSnapshot: true,
            purchaseDate: true,
            supplierName: true,
            invoiceNumber: true,
            _count: { select: { lines: true } },
          },
        },
      },
    }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getPurchaseTransaction(id: string) {
  const transaction = await prisma.purchaseTransaction.findUnique({
    where: { id },
    include: {
      sheets: {
        orderBy: [{ purchaseDate: "asc" }, { inventoryCategoryNameSnapshot: "asc" }],
        include: { lines: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
      },
    },
  });
  if (!transaction) throw new PurchaseError("Purchase transaction not found.", 404);
  return transaction;
}

export async function voidPurchaseTransaction(id: string, actorEmail: string, reason: string) {
  const normalizedReason = requiredText(reason, "Void reason", 1000);
  const result = await prisma.purchaseTransaction.updateMany({
    where: { id, voidedAt: null },
    data: {
      voidedAt: new Date(),
      voidedByEmail: actorEmail,
      voidReason: normalizedReason,
    },
  });
  if (result.count === 0) {
    const existing = await prisma.purchaseTransaction.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new PurchaseError("Purchase transaction not found.", 404);
    throw new PurchaseError("This purchase transaction has already been voided.", 409);
  }
  return getPurchaseTransaction(id);
}