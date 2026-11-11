import { Prisma } from "@prisma/client";
import type { Request, RequestHandler } from "express";

import {
  CatalogueError,
  listUnits,
  listCategories,
  createCategory,
  updateCategory,
  archiveCategory,
  listAllergens,
  createAllergen,
  updateAllergen,
  archiveAllergen,
  listIngredients,
  getIngredient,
  createIngredient,
  updateIngredient,
  archiveIngredient,
  setIngredientConversion,
  removeIngredientConversion,
  setIngredientAllergen,
  removeIngredientAllergen,
  isAllergenPresence,
} from "../services/ingredient-catalogue.service.js";

import { IngredientValidationError } from "../services/ingredient-validation.js";

type JsonObject = Record<string, unknown>;

function bodyObject(req: Request): JsonObject {
  const value: unknown = req.body;

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CatalogueError("Request body must be a JSON object.");
  }

  return value as JsonObject;
}

function requiredString(
  body: JsonObject,
  field: string,
  maxLength: number,
): string {
  const value = body[field];

  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.trim().length > maxLength
  ) {
    throw new CatalogueError(
      `${field} must contain between 1 and ${maxLength} characters.`,
    );
  }

  return value.trim();
}

function optionalString(
  body: JsonObject,
  field: string,
  maxLength: number,
  nullable = false,
): string | null | undefined {
  const value = body[field];

  if (value === undefined) return undefined;

  if (value === null && nullable) return null;

  if (typeof value !== "string" || value.length > maxLength) {
    throw new CatalogueError(`${field} must be a string of at most ${maxLength} characters.`);
  }

  return value;
}

function optionalBoolean(
  body: JsonObject,
  field: string,
): boolean | undefined {
  const value = body[field];

  if (value === undefined) return undefined;

  if (typeof value !== "boolean") {
    throw new CatalogueError(`${field} must be true or false.`);
  }

  return value;
}

function optionalInteger(
  body: JsonObject,
  field: string,
): number | undefined {
  const value = body[field];

  if (value === undefined) return undefined;

  if (!Number.isInteger(value)) {
    throw new CatalogueError(`${field} must be an integer.`);
  }

  return value as number;
}

function pathParam(req: Request, name: string): string {
  const value = req.params[name];

  if (typeof value !== "string" || !value.trim()) {
    throw new CatalogueError(`Missing ${name}.`);
  }

  return value.trim();
}

function queryBoolean(value: unknown, field: string): boolean {
  if (value === undefined) return false;
  if (value === "true") return true;
  if (value === "false") return false;

  throw new CatalogueError(`${field} must be true or false.`);
}

function queryString(
  value: unknown,
  field: string,
  maxLength: number,
): string | undefined {
  if (value === undefined) return undefined;

  if (typeof value !== "string" || value.length > maxLength) {
    throw new CatalogueError(`${field} must be a string of at most ${maxLength} characters.`);
  }

  return value;
}

function parseConversions(value: unknown) {
  if (value === undefined) return undefined;

  if (!Array.isArray(value) || value.length > 50) {
    throw new CatalogueError("conversions must be an array with at most 50 entries.");
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new CatalogueError(`Conversion ${index + 1} must be an object.`);
    }

    const item = entry as JsonObject;

    if (
      typeof item.quantityInBaseUnit !== "string" ||
      !item.quantityInBaseUnit.trim()
    ) {
      throw new CatalogueError(
        `Conversion ${index + 1}: quantityInBaseUnit must be a decimal string.`,
      );
    }

    return {
      unitId: requiredString(item, "unitId", 128),
      quantityInBaseUnit: item.quantityInBaseUnit.trim(),
      isApproximate: optionalBoolean(item, "isApproximate"),
      notes: optionalString(item, "notes", 255, true),
    };
  });
}

function createIngredientInput(body: JsonObject) {
  return {
    code: requiredString(body, "code", 64),
    name: requiredString(body, "name", 160),
    baseUnitId: requiredString(body, "baseUnitId", 128),
    sku: optionalString(body, "sku", 80, true),
    description: optionalString(body, "description", 10000, true),
    categoryId: optionalString(body, "categoryId", 128, true),
    defaultPurchaseUnitId: optionalString(
      body,
      "defaultPurchaseUnitId",
      128,
      true,
    ),
    isStockTracked: optionalBoolean(body, "isStockTracked"),
    sortOrder: optionalInteger(body, "sortOrder"),
    conversions: parseConversions(body.conversions),
  };
}

function updateIngredientInput(body: JsonObject) {
  return {
    ...(body.code !== undefined
      ? { code: requiredString(body, "code", 64) }
      : {}),
    ...(body.name !== undefined
      ? { name: requiredString(body, "name", 160) }
      : {}),
    ...(body.baseUnitId !== undefined
      ? { baseUnitId: requiredString(body, "baseUnitId", 128) }
      : {}),
    ...(body.sku !== undefined
      ? { sku: optionalString(body, "sku", 80, true) }
      : {}),
    ...(body.description !== undefined
      ? { description: optionalString(body, "description", 10000, true) }
      : {}),
    ...(body.categoryId !== undefined
      ? { categoryId: optionalString(body, "categoryId", 128, true) }
      : {}),
    ...(body.defaultPurchaseUnitId !== undefined
      ? {
          defaultPurchaseUnitId: optionalString(
            body,
            "defaultPurchaseUnitId",
            128,
            true,
          ),
        }
      : {}),
    ...(body.isStockTracked !== undefined
      ? { isStockTracked: optionalBoolean(body, "isStockTracked") }
      : {}),
    ...(body.sortOrder !== undefined
      ? { sortOrder: optionalInteger(body, "sortOrder") }
      : {}),
  };
}

function createCategoryInput(body: JsonObject) {
  return {
    code: requiredString(body, "code", 40),
    name: requiredString(body, "name", 100),
    description: optionalString(body, "description", 10000, true),
    sortOrder: optionalInteger(body, "sortOrder"),
  };
}

function updateCategoryInput(body: JsonObject) {
  return {
    ...(body.code !== undefined
      ? { code: requiredString(body, "code", 40) }
      : {}),
    ...(body.name !== undefined
      ? { name: requiredString(body, "name", 100) }
      : {}),
    ...(body.description !== undefined
      ? { description: optionalString(body, "description", 10000, true) }
      : {}),
    ...(body.sortOrder !== undefined
      ? { sortOrder: optionalInteger(body, "sortOrder") }
      : {}),
  };
}

function createAllergenInput(body: JsonObject) {
  return {
    code: requiredString(body, "code", 40),
    name: requiredString(body, "name", 100),
  };
}

function updateAllergenInput(body: JsonObject) {
  return {
    ...(body.code !== undefined
      ? { code: requiredString(body, "code", 40) }
      : {}),
    ...(body.name !== undefined
      ? { name: requiredString(body, "name", 100) }
      : {}),
  };
}

function controller(
  action: (req: Request) => Promise<unknown>,
  successStatus = 200,
): RequestHandler {
  return async (req, res) => {
    try {
      const result = await action(req);
      res.status(successStatus).json(result);
    } catch (error) {
      if (error instanceof CatalogueError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }

      if (error instanceof IngredientValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          res.status(409).json({ error: "A record with this code or SKU already exists." });
          return;
        }

        if (error.code === "P2003" || error.code === "P2014") {
          res.status(409).json({ error: "This change conflicts with an existing catalogue relationship." });
          return;
        }

        if (error.code === "P2025") {
          res.status(404).json({ error: "The requested catalogue record was not found." });
          return;
        }
      }

      console.error("Ingredient catalogue request failed", {
        name: (error as { name?: string })?.name,
        code: (error as { code?: string })?.code,
      });

      res.status(500).json({
        error: "Unable to complete the catalogue request. Please try again.",
      });
    }
  };
}

// Units
export const getUnits = controller(async () => listUnits());

// Categories
export const getCategories = controller(async (req) =>
  listCategories(queryBoolean(req.query.includeInactive, "includeInactive")),
);

export const postCategory = controller(
  async (req) => createCategory(createCategoryInput(bodyObject(req))),
  201,
);

export const patchCategory = controller(async (req) =>
  updateCategory(pathParam(req, "id"), updateCategoryInput(bodyObject(req))),
);

export const postArchiveCategory = controller(async (req) =>
  archiveCategory(pathParam(req, "id")),
);

// Allergens
export const getAllergens = controller(async (req) =>
  listAllergens(queryBoolean(req.query.includeInactive, "includeInactive")),
);

export const postAllergen = controller(
  async (req) => createAllergen(createAllergenInput(bodyObject(req))),
  201,
);

export const patchAllergen = controller(async (req) =>
  updateAllergen(pathParam(req, "id"), updateAllergenInput(bodyObject(req))),
);

export const postArchiveAllergen = controller(async (req) =>
  archiveAllergen(pathParam(req, "id")),
);

// Ingredients
export const getIngredients = controller(async (req) =>
  listIngredients({
    query: queryString(req.query.query, "query", 120),
    categoryId: queryString(req.query.categoryId, "categoryId", 128),
    includeInactive: queryBoolean(
      req.query.includeInactive,
      "includeInactive",
    ),
  }),
);

export const getIngredientById = controller(async (req) =>
  getIngredient(pathParam(req, "id")),
);

export const postIngredient = controller(
  async (req) => createIngredient(createIngredientInput(bodyObject(req))),
  201,
);

export const patchIngredient = controller(async (req) =>
  updateIngredient(
    pathParam(req, "id"),
    updateIngredientInput(bodyObject(req)),
  ),
);

export const postArchiveIngredient = controller(async (req) =>
  archiveIngredient(pathParam(req, "id")),
);

export const putIngredientConversion = controller(async (req) => {
  const body = bodyObject(req);

  return setIngredientConversion(
    pathParam(req, "id"),
    pathParam(req, "unitId"),
    {
      quantityInBaseUnit: requiredString(
        body,
        "quantityInBaseUnit",
        32,
      ),
      isApproximate: optionalBoolean(body, "isApproximate"),
      notes: optionalString(body, "notes", 255, true),
    },
  );
});

export const deleteIngredientConversion = controller(async (req) =>
  removeIngredientConversion(
    pathParam(req, "id"),
    pathParam(req, "unitId"),
  ),
);

export const putIngredientAllergen = controller(async (req) => {
  const body = bodyObject(req);
  const presence = body.presence;

  if (!isAllergenPresence(presence)) {
    throw new CatalogueError(
      "presence must be CONTAINS, MAY_CONTAIN or CROSS_CONTACT_RISK.",
    );
  }

  return setIngredientAllergen(
    pathParam(req, "id"),
    pathParam(req, "allergenId"),
    {
      presence,
      notes: optionalString(body, "notes", 255, true),
    },
  );
});

export const deleteIngredientAllergen = controller(async (req) =>
  removeIngredientAllergen(
    pathParam(req, "id"),
    pathParam(req, "allergenId"),
  ),
);
