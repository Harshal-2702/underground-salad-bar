import { Prisma } from "@prisma/client";
import type { Request, RequestHandler, Response } from "express";
import {
  getLeftoverInventoryTransaction,
  LeftoverInventoryError,
  listLeftoverInventory,
  submitLeftoverInventory,
  type LeftoverHistoryFilters,
} from "../services/leftover-inventory.service.js";

function adminEmail(res: Response): string {
  const email = res.locals.adminEmail;
  if (typeof email !== "string" || !email.trim()) {
    throw new LeftoverInventoryError("Verified staff identity is missing.", 403);
  }
  return email.trim().toLowerCase();
}

function queryString(req: Request, field: string, maxLength = 200): string | undefined {
  const value = req.query[field];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > maxLength) {
    throw new LeftoverInventoryError(`${field} is invalid.`);
  }
  return value.trim() || undefined;
}

function queryInteger(req: Request, field: string, fallback: number, max: number): number {
  const value = queryString(req, field, 12);
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) throw new LeftoverInventoryError(`${field} must be a whole number.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) {
    throw new LeftoverInventoryError(`${field} is outside the supported range.`);
  }
  return parsed;
}

function controller(action: (req: Request, res: Response) => Promise<unknown>, status = 200): RequestHandler {
  return async (req, res) => {
    try {
      res.status(status).json(await action(req, res));
    } catch (error) {
      if (error instanceof LeftoverInventoryError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          res.status(409).json({ error: "An ingredient can only be recorded once per stocktake." });
          return;
        }
        if (error.code === "P2025") {
          res.status(404).json({ error: "The stocktake transaction was not found." });
          return;
        }
      }
      console.error("Leftover inventory request failed", {
        name: (error as { name?: string })?.name,
        code: (error as { code?: string })?.code,
      });
      res.status(500).json({ error: "Unable to complete the leftover inventory request. Please try again." });
    }
  };
}

export const postLeftoverInventory = controller(async (req, res) =>
  submitLeftoverInventory(adminEmail(res), req.body),
  201,
);

export const getLeftoverHistory = controller(async (req) => {
  const filters: LeftoverHistoryFilters = {
    from: queryString(req, "from", 10),
    to: queryString(req, "to", 10),
    categoryId: queryString(req, "categoryId", 128),
    recordedBy: queryString(req, "recordedBy", 255),
    page: queryInteger(req, "page", 1, 100000),
    pageSize: queryInteger(req, "pageSize", 10, 100),
  };
  return listLeftoverInventory(filters);
});

export const getLeftoverTransaction = controller(async (req) =>
  getLeftoverInventoryTransaction(req.params.id ?? ""),
);
