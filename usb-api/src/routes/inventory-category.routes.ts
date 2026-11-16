import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin.js";
import {
  getInventoryCategories,
  postInventoryCategory,
  patchInventoryCategory,
} from "../controllers/inventory-category.controller.js";

export const inventoryCategoryRouter = Router();
inventoryCategoryRouter.use(requireAdmin);
inventoryCategoryRouter.get("/", getInventoryCategories);
inventoryCategoryRouter.post("/", postInventoryCategory);
inventoryCategoryRouter.patch("/:id", patchInventoryCategory);
