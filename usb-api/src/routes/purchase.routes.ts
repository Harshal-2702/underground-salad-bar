import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin.js";
import {
  getDraft,
  getHistory,
  getTransaction,
  postSubmitPurchase,
  postVoidTransaction,
  putDraft,
} from "../controllers/purchase.controller.js";

export const purchaseRouter = Router();
purchaseRouter.use(requireAdmin);
purchaseRouter.get("/draft", getDraft);
purchaseRouter.put("/draft", putDraft);
purchaseRouter.post("/submit", postSubmitPurchase);
purchaseRouter.get("/history", getHistory);
purchaseRouter.get("/:id", getTransaction);
purchaseRouter.post("/:id/void", postVoidTransaction);