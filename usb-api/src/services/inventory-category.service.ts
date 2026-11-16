import { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { CatalogueError } from "./ingredient-catalogue.service.js";

export interface InventoryCategoryInput {
  code: string;
  name: string;
  sortOrder?: number;
}

export interface InventoryCategoryUpdateInput {
  code?: string;
  name?: string;
  sortOrder?: number;
}

function categoryCode(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!normalized || normalized.length > 40 || !/^[A-Z0-9][A-Z0-9_-]*$/.test(normalized)) {
    throw new CatalogueError("Category code must be 1â€“40 characters and use only letters, numbers, underscores or hyphens.");
  }
  return normalized;
}

function categoryName(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 100) {
    throw new CatalogueError("Category name must contain between 1 and 100 characters.");
  }
  return normalized;
}

function displayOrder(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 0 || value > 1000000) {
    throw new CatalogueError("Display order must be a whole number between 0 and 1,000,000.");
  }
  return value;
}

export async function listInventoryCategories(includeInactive = false) {
  return prisma.inventoryCategory.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function createInventoryCategory(input: InventoryCategoryInput) {
  return prisma.inventoryCategory.create({
    data: {
      code: categoryCode(input.code),
      name: categoryName(input.name),
      sortOrder: displayOrder(input.sortOrder) ?? 0,
    },
  });
}

export async function updateInventoryCategory(id: string, input: InventoryCategoryUpdateInput) {
  const data: Prisma.InventoryCategoryUncheckedUpdateInput = {};
  if (input.code !== undefined) data.code = categoryCode(input.code);
  if (input.name !== undefined) data.name = categoryName(input.name);
  if (input.sortOrder !== undefined) data.sortOrder = displayOrder(input.sortOrder) ?? 0;

  if (Object.keys(data).length === 0) {
    throw new CatalogueError("Provide at least one field to update.");
  }

  const existing = await prisma.inventoryCategory.findUnique({
    where: { id },
    select: { id: true, isActive: true },
  });
  if (!existing) throw new CatalogueError("Inventory purchasing category not found.", 404);
  if (!existing.isActive) {
    throw new CatalogueError("Inactive inventory purchasing categories cannot be edited.", 409);
  }

  return prisma.inventoryCategory.update({
    where: { id },
    data,
  });
}