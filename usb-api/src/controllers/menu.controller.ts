import type { RequestHandler } from "express";
import { getPublicMenuCatalog } from "../services/pricing.js";

export const getMenu: RequestHandler = (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
  res.status(200).json(getPublicMenuCatalog());
};
