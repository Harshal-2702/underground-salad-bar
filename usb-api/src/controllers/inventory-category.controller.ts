import { Prisma } from "@prisma/client";
import type { Request, RequestHandler } from "express";

import { CatalogueError } from "../services/ingredient-catalogue.service.js";
import {
  createInventoryCategory,
  listInventoryCategories,
  updateInventoryCategory,
} from "../services/inventory-category.service.js";

type JsonObject = Record<string, unknown>;

function bodyObject(req: Request): JsonObject {
  const value: unknown = req.body;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CatalogueError("Request body must be a JSON object.");
  }
  return value as JsonObject;
}

function requiredString(body: JsonObject, field: string, maxLength: number): string {
  const value = body[field];
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw new CatalogueError(`${field} must contain between 1 and ${maxLength} characters.`);
  }
  return value.trim();
}

function optionalInteger(body: JsonObject, field: string): number | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new CatalogueError(`${field} must be a whole number.`);
  }
  return value;
}

function pathId(req: Request): string {
  const id = req.params.id;
  if (typeof id !== "string" || !id.trim()) throw new CatalogueError("Missing category id.");
  return id.trim();
}

function includeInactive(req: Request): boolean {
  const value = req.query.includeInactive;
  if (value === undefined || value === "false") return false;
  if (value === "true") return true;
  throw new CatalogueError("includeInactive must be true or false.");
}

function controller(action: (req: Request) => Promise<unknown>, successStatus = 200): RequestHandler {
  return async (req, res) => {
    try {
      res.status(successStatus).json(await action(req));
    } catch (error) {
      if (error instanceof CatalogueError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          res.status(409).json({ error: "An inventory category with this code already exists." });
          return;
        }
        if (error.code === "P2025") {
          res.status(404).json({ error: "The requested inventory category was not found." });
          return;
        }
      }
      console.error("Inventory category request failed", {
        name: (error as { name?: string })?.name,
        code: (error as { code?: string })?.code,
      });
      res.status(500).json({ error: "Unable to complete the inventory category request. Please try again." });
    }
  };
}

export const getInventoryCategories = controller(async (req) =>
  listInventoryCategories(includeInactive(req)),
);

export const postInventoryCategory = controller(async (req) => {
  const body = bodyObject(req);
  return createInventoryCategory({
    code: requiredString(body, "code", 40),
    name: requiredString(body, "name", 100),
    sortOrder: optionalInteger(body, "sortOrder"),
  });
}, 201);

export const patchInventoryCategory = controller(async (req) => {
  const body = bodyObject(req);
  return updateInventoryCategory(pathId(req), {
    ...(body.code !== undefined ? { code: requiredString(body, "code", 40) } : {}),
    ...(body.name !== undefined ? { name: requiredString(body, "name", 100) } : {}),
    ...(body.sortOrder !== undefined ? { sortOrder: optionalInteger(body, "sortOrder") } : {}),
  });
});