import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin.js";

import {
  getRecipes,
  getRecipeById,
  postRecipe,
  postRecipeVersion,
  patchRecipeVersion,
  postRecipeIngredient,
  deleteRecipeIngredient,
  postRecipeSubrecipe,
  deleteRecipeSubrecipe,
  putRecipeSteps,
  postPublishRecipeVersion,
  patchRecipe,
  postArchiveRecipe,
  postRestoreRecipe,
  postArchiveRecipeVersion,
} from "../controllers/recipe.controller.js";

export const recipeRouter = Router();

recipeRouter.use(requireAdmin);

recipeRouter.get("/", getRecipes);
recipeRouter.post("/", postRecipe);
recipeRouter.get("/:recipeId", getRecipeById);

recipeRouter.post("/:recipeId/versions", postRecipeVersion);
recipeRouter.patch("/:recipeId/versions/:versionId", patchRecipeVersion);

recipeRouter.post("/:recipeId/versions/:versionId/ingredients", postRecipeIngredient);
recipeRouter.delete("/:recipeId/versions/:versionId/ingredients/:lineId", deleteRecipeIngredient);

recipeRouter.post("/:recipeId/versions/:versionId/subrecipes", postRecipeSubrecipe);
recipeRouter.delete("/:recipeId/versions/:versionId/subrecipes/:lineId", deleteRecipeSubrecipe);

recipeRouter.put("/:recipeId/versions/:versionId/steps", putRecipeSteps);
recipeRouter.post("/:recipeId/versions/:versionId/publish", postPublishRecipeVersion);

recipeRouter.patch("/:recipeId", patchRecipe);
recipeRouter.post("/:recipeId/archive", postArchiveRecipe);
recipeRouter.post("/:recipeId/restore", postRestoreRecipe);
recipeRouter.post("/:recipeId/versions/:versionId/archive", postArchiveRecipeVersion);
