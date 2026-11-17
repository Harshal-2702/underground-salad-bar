import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin.js";
import {
  getLeftoverHistory,
  getLeftoverTransaction,
  postLeftoverInventory,
} from "../controllers/leftover-inventory.controller.js";

export const leftoverInventoryRouter = Router();
leftoverInventoryRouter.use(requireAdmin);
leftoverInventoryRouter.get("/history", getLeftoverHistory);
leftoverInventoryRouter.get("/:id", getLeftoverTransaction);
leftoverInventoryRouter.post("/", postLeftoverInventory);
