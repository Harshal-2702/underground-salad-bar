import { Prisma } from "@prisma/client";
import type { Request, RequestHandler, Response } from "express";
import {
  getPurchaseDraft,
  getPurchaseTransaction,
  listPurchaseHistory,
  PurchaseError,
  savePurchaseDraft,
  submitPurchase,
  voidPurchaseTransaction,
  type PurchaseHistoryFilters,
} from "../services/purchase.service.js";

type JsonObject = Record<string, unknown>;

function adminEmail(res: { locals: Record<string, unknown> }): string {
  const email = res.locals.adminEmail;
  if (typeof email !== "string" || !email.trim()) {
    throw new PurchaseError("Verified staff identity is missing.", 403);
  }
  return email.trim().toLowerCase();
}

function bodyObject(req: Request): JsonObject {
  const value: unknown = req.body;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PurchaseError("Request body must be a JSON object.");
  }
  return value as JsonObject;
}

function pathId(req: Request): string {
  const value = req.params.id;
  if (typeof value !== "string" || !value.trim() || value.length > 128) {
    throw new PurchaseError("Purchase transaction ID is invalid.");
  }
  return value.trim();
}

function queryString(req: Request, field: string, maxLength = 200): string | undefined {
  const value = req.query[field];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > maxLength) {
    throw new PurchaseError(`${field} is invalid.`);
  }
  return value.trim() || undefined;
}

function queryInteger(req: Request, field: string, fallback: number, max: number): number {
  const value = queryString(req, field, 12);
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) throw new PurchaseError(`${field} must be a whole number.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) {
    throw new PurchaseError(`${field} is outside the supported range.`);
  }
  return parsed;
}

function controller(action: (req: Request, res: Response) => Promise<unknown>, status = 200): RequestHandler {
  return async (req, res) => {
    try {
      res.status(status).json(await action(req, res));
    } catch (error) {
      if (error instanceof PurchaseError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          res.status(409).json({ error: "A conflicting purchase record already exists." });
          return;
        }
        if (error.code === "P2003") {
          res.status(409).json({ error: "A referenced catalogue record is in use or no longer available." });
          return;
        }
        if (error.code === "P2025") {
          res.status(404).json({ error: "The requested purchase record was not found." });
          return;
        }
      }
      console.error("Purchase request failed", {
        name: (error as { name?: string })?.name,
        code: (error as { code?: string })?.code,
      });
      res.status(500).json({ error: "Unable to complete the purchase request. Please try again." });
    }
  };
}

export const getDraft = controller(async (_req, res) =>
  getPurchaseDraft(adminEmail(res)),
);

export const putDraft = controller(async (req, res) =>
  savePurchaseDraft(adminEmail(res), bodyObject(req).data),
);

export const postSubmitPurchase = controller(async (req, res) =>
  submitPurchase(adminEmail(res), bodyObject(req)),
  201,
);

export const getHistory = controller(async (req) => {
  const sortByValue = queryString(req, "sortBy", 24) ?? "createdAt";
  if (!["createdAt", "reference", "totalAmount"].includes(sortByValue)) {
    throw new PurchaseError("sortBy is not supported.");
  }
  const sortOrderValue = queryString(req, "sortOrder", 4) ?? "desc";
  if (sortOrderValue !== "asc" && sortOrderValue !== "desc") {
    throw new PurchaseError("sortOrder must be asc or desc.");
  }

  const filters: PurchaseHistoryFilters = {
    from: queryString(req, "from", 10),
    to: queryString(req, "to", 10),
    categoryId: queryString(req, "categoryId", 128),
    supplier: queryString(req, "supplier", 160),
    ingredient: queryString(req, "ingredient", 160),
    invoice: queryString(req, "invoice", 120),
    recordedBy: queryString(req, "recordedBy", 255),
    reference: queryString(req, "reference", 40),
    minAmount: queryString(req, "minAmount", 24),
    maxAmount: queryString(req, "maxAmount", 24),
    sortBy: sortByValue as PurchaseHistoryFilters["sortBy"],
    sortOrder: sortOrderValue,
    page: queryInteger(req, "page", 1, 100000),
    pageSize: queryInteger(req, "pageSize", 25, 100),
  };
  return listPurchaseHistory(filters);
});

export const getTransaction = controller(async (req) =>
  getPurchaseTransaction(pathId(req)),
);

export const postVoidTransaction = controller(async (req, res) => {
  const body = bodyObject(req);
  if (typeof body.reason !== "string") {
    throw new PurchaseError("A reason is required to void a purchase transaction.");
  }
  return voidPurchaseTransaction(pathId(req), adminEmail(res), body.reason);
});