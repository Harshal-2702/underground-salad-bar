import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin.js";

import {
  getUnits,
  getCategories,
  postCategory,
  patchCategory,
  postArchiveCategory,
  getAllergens,
  postAllergen,
  patchAllergen,
  postArchiveAllergen,
  getIngredients,
  getIngredientById,
  postIngredient,
  patchIngredient,
  postArchiveIngredient,
  putIngredientConversion,
  deleteIngredientConversion,
  putIngredientAllergen,
  deleteIngredientAllergen,
} from "../controllers/ingredient-catalogue.controller.js";

export const ingredientRouter = Router();
export const unitRouter = Router();
export const categoryRouter = Router();
export const allergenRouter = Router();

// Every catalogue route is staff-only.
ingredientRouter.use(requireAdmin);
unitRouter.use(requireAdmin);
categoryRouter.use(requireAdmin);
allergenRouter.use(requireAdmin);

// Units
unitRouter.get("/", getUnits);

// Ingredient categories
categoryRouter.get("/", getCategories);
categoryRouter.post("/", postCategory);
categoryRouter.patch("/:id", patchCategory);
categoryRouter.patch("/:id/archive", postArchiveCategory);

// Allergens
allergenRouter.get("/", getAllergens);
allergenRouter.post("/", postAllergen);
allergenRouter.patch("/:id", patchAllergen);
allergenRouter.patch("/:id/archive", postArchiveAllergen);

// Ingredients
ingredientRouter.get("/", getIngredients);
ingredientRouter.post("/", postIngredient);
ingredientRouter.get("/:id", getIngredientById);
ingredientRouter.patch("/:id", patchIngredient);
ingredientRouter.patch("/:id/archive", postArchiveIngredient);

// Ingredient-specific unit conversions
ingredientRouter.put("/:id/conversions/:unitId", putIngredientConversion);
ingredientRouter.delete("/:id/conversions/:unitId", deleteIngredientConversion);

// Ingredient allergen associations
ingredientRouter.put("/:id/allergens/:allergenId", putIngredientAllergen);
ingredientRouter.delete("/:id/allergens/:allergenId", deleteIngredientAllergen);
