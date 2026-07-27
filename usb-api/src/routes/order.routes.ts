import { Router } from "express";

console.log("🔥 ROUTES FILE LOADED");

import {
  createOrder,
  getOrders,
  updateOrderStatus,
} from "../controllers/order.controller.js";

console.log("createOrder =", createOrder);

const router = Router();

router.post("/", async (req, res) => {
  console.log("🔥 ROUTE HIT");
  await createOrder(req, res);
});

router.get("/", getOrders);

router.patch("/:id/status", updateOrderStatus);

export default router;