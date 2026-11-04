import { Router } from "express";
import {
  createOrder,
  getOrders,
  updateOrderStatus,
} from "../controllers/order.controller.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

// Public customer checkout. Prices are recalculated and validated by the API.
router.post("/", createOrder);

// Staff-only endpoints: customer/order data must never be publicly readable.
router.get("/", requireAdmin, getOrders);
router.patch("/:id/status", requireAdmin, updateOrderStatus);

export default router;
