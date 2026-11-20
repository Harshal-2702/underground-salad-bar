import { Prisma, RecipeType } from "@prisma/client";
import type { Request, RequestHandler } from "express";

import {
  RecipeError,
  listRecipes,
  getRecipe,
  createRecipe,
  createDraftVersion,
  updateDraftVersion,
  addIngredientLine,
  removeIngredientLine,
  addSubrecipeLine,
  removeSubrecipeLine,
  replaceRecipeSteps,
  publishRecipeVersion,
  updateRecipe,
  archiveRecipe,
  restoreRecipe,
  archiveDraftVersion,
} from "../services/recipe.service.js";

type JsonObject = Record<string, unknown>;

function bodyObject(req: Request): JsonObject {
  const value: unknown = req.body;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RecipeError("Request body must be a JSON object.");
  }
  return value as JsonObject;
}

function requiredString(body: JsonObject, field: string, max: number): string {
  const value = body[field];
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new RecipeError(`${field} must contain between 1 and ${max} characters.`);
  }
  return value.trim();
}

function decimalString(body: JsonObject, field: string): string {
  return requiredString(body, field, 32);
}

function optionalString(
  body: JsonObject,
  field: string,
  max: number,
): string | null | undefined {
  const value = body[field];
  if (value === undefined || value === null) return value;
  if (typeof value !== "string" || value.length > max) {
    throw new RecipeError(`${field} must be a string of at most ${max} characters.`);
  }
  return value;
}

function optionalInteger(body: JsonObject, field: string): number | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (!Number.isInteger(value)) throw new RecipeError(`${field} must be an integer.`);
  return value as number;
}

function pathParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new RecipeError(`Missing ${name}.`);
  }
  return value.trim();
}

function createRecipeBody(body: JsonObject) {
  const recipeType = body.recipeType;
  if (
    typeof recipeType !== "string" ||
    !Object.values(RecipeType).includes(recipeType as RecipeType)
  ) {
    throw new RecipeError("recipeType must be PREPARATION, MENU_ITEM or BOWL_COMPONENT.");
  }

  return {
    code: requiredString(body, "code", 64),
    name: requiredString(body, "name", 160),
    recipeType: recipeType as RecipeType,
    description: optionalString(body, "description", 10000),
    outputQuantity: decimalString(body, "outputQuantity"),
    outputUnitId: requiredString(body, "outputUnitId", 128),
    yieldNotes: optionalString(body, "yieldNotes", 5000),
    changeSummary: optionalString(body, "changeSummary", 5000),
  };
}

function updateVersionBody(body: JsonObject) {
  return {
    ...(body.outputQuantity !== undefined
      ? { outputQuantity: decimalString(body, "outputQuantity") }
      : {}),
    ...(body.outputUnitId !== undefined
      ? { outputUnitId: requiredString(body, "outputUnitId", 128) }
      : {}),
    ...(body.yieldNotes !== undefined
      ? { yieldNotes: optionalString(body, "yieldNotes", 5000) }
      : {}),
    ...(body.changeSummary !== undefined
      ? { changeSummary: optionalString(body, "changeSummary", 5000) }
      : {}),
  };
}

function ingredientLineBody(body: JsonObject) {
  return {
    ingredientId: requiredString(body, "ingredientId", 128),
    quantity: decimalString(body, "quantity"),
    notes: optionalString(body, "notes", 1000),
    sortOrder: optionalInteger(body, "sortOrder"),
  };
}

function subrecipeLineBody(body: JsonObject) {
  return {
    componentRecipeVersionId: requiredString(body, "componentRecipeVersionId", 128),
    quantity: decimalString(body, "quantity"),
    notes: optionalString(body, "notes", 1000),
    sortOrder: optionalInteger(body, "sortOrder"),
  };
}

function stepsBody(body: JsonObject) {
  const value = body.steps;
  if (!Array.isArray(value) || value.length > 100) {
    throw new RecipeError("steps must be an array with at most 100 entries.");
  }

  return value.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new RecipeError(`Step ${index + 1} must be an object.`);
    }

    const step = raw as JsonObject;
    const stepNumber = step.stepNumber;
    if (!Number.isInteger(stepNumber)) {
      throw new RecipeError(`Step ${index + 1}: stepNumber must be an integer.`);
    }

    const timerSeconds = step.timerSeconds;
    if (
      timerSeconds !== undefined &&
      timerSeconds !== null &&
      !Number.isInteger(timerSeconds)
    ) {
      throw new RecipeError(`Step ${index + 1}: timerSeconds must be an integer or null.`);
    }

    return {
      stepNumber: stepNumber as number,
      title: optionalString(step, "title", 160),
      instruction: requiredString(step, "instruction", 4000),
      timerSeconds: timerSeconds as number | null | undefined,
    };
  });
}

function includeInactive(req: Request): boolean {
  const value = req.query.includeInactive;
  if (value === undefined || value === "false") return false;
  if (value === "true") return true;
  throw new RecipeError("includeInactive must be true or false.");
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
      if (error instanceof RecipeError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002" || error.code === "P2003" || error.code === "P2014" || error.code === "P2034") {
          res.status(409).json({ error: "This change conflicts with an existing recipe or version." });
          return;
        }
        if (error.code === "P2025") {
          res.status(404).json({ error: "The requested recipe record was not found." });
          return;
        }
      }

      console.error("Recipe Studio request failed", {
        name: (error as { name?: string })?.name,
        code: (error as { code?: string })?.code,
      });

      res.status(500).json({
        error: "Unable to complete the recipe request. Please try again.",
      });
    }
  };
}

export const getRecipes = controller(async (req) =>
  listRecipes(includeInactive(req)),
);

export const getRecipeById = controller(async (req) =>
  getRecipe(pathParam(req, "recipeId")),
);

export const postRecipe = controller(async (req) =>
  createRecipe(createRecipeBody(bodyObject(req))),
  201,
);

export const postRecipeVersion = controller(async (req) =>
  createDraftVersion(
    pathParam(req, "recipeId"),
    optionalString(bodyObject(req), "changeSummary", 5000),
  ),
  201,
);

export const patchRecipeVersion = controller(async (req) =>
  updateDraftVersion(
    pathParam(req, "recipeId"),
    pathParam(req, "versionId"),
    updateVersionBody(bodyObject(req)),
  ),
);

export const postRecipeIngredient = controller(async (req) =>
  addIngredientLine(
    pathParam(req, "recipeId"),
    pathParam(req, "versionId"),
    ingredientLineBody(bodyObject(req)),
  ),
  201,
);

export const deleteRecipeIngredient = controller(async (req) =>
  removeIngredientLine(
    pathParam(req, "recipeId"),
    pathParam(req, "versionId"),
    pathParam(req, "lineId"),
  ),
);

export const postRecipeSubrecipe = controller(async (req) =>
  addSubrecipeLine(
    pathParam(req, "recipeId"),
    pathParam(req, "versionId"),
    subrecipeLineBody(bodyObject(req)),
  ),
  201,
);

export const deleteRecipeSubrecipe = controller(async (req) =>
  removeSubrecipeLine(
    pathParam(req, "recipeId"),
    pathParam(req, "versionId"),
    pathParam(req, "lineId"),
  ),
);

export const putRecipeSteps = controller(async (req) =>
  replaceRecipeSteps(
    pathParam(req, "recipeId"),
    pathParam(req, "versionId"),
    stepsBody(bodyObject(req)),
  ),
);

export const postPublishRecipeVersion = controller(async (req) =>
  publishRecipeVersion(
    pathParam(req, "recipeId"),
    pathParam(req, "versionId"),
  ),
);

// Recipe identity and lifecycle.
export const patchRecipe = controller(async (req) => {
  const body = bodyObject(req);

  return updateRecipe(pathParam(req, "recipeId"), {
    ...(body.name !== undefined
      ? { name: requiredString(body, "name", 160) }
      : {}),
    ...(body.description !== undefined
      ? { description: optionalString(body, "description", 10000) }
      : {}),
  });
});

export const postArchiveRecipe = controller(async (req) =>
  archiveRecipe(pathParam(req, "recipeId")),
);

export const postRestoreRecipe = controller(async (req) =>
  restoreRecipe(pathParam(req, "recipeId")),
);

export const postArchiveRecipeVersion = controller(async (req) =>
  archiveDraftVersion(
    pathParam(req, "recipeId"),
    pathParam(req, "versionId"),
  ),
);
