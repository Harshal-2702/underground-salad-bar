import type { Request, RequestHandler, Response } from "express";
import { NcError, createNcEntry, listNcEntries, updateNcEntryStatus } from "../services/nc.service.js";
import { getIndiaBusinessDate, isDateKey } from "../services/kot.service.js";

function signedInEmail(res: Response): string {
  const email = res.locals.adminEmail;
  if (typeof email !== "string" || !email.trim()) throw new NcError("Verified staff identity is missing.", 403);
  return email.trim().toLowerCase();
}

function controller(action: (req: Request, res: Response) => Promise<unknown>, successStatus = 200): RequestHandler {
  return async (req, res) => {
    try {
      res.status(successStatus).json(await action(req, res));
    } catch (error) {
      if (error instanceof NcError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      console.error("NC request failed", {
        name: (error as { name?: string })?.name,
        code: (error as { code?: string })?.code,
      });
      res.status(500).json({ error: "Unable to complete the NC request. Please try again." });
    }
  };
}

export const getNcEntries = controller(async (req) => {
  const date = req.query.date === undefined ? getIndiaBusinessDate() : req.query.date;
  if (typeof date !== "string" || !isDateKey(date)) throw new NcError("Date must use YYYY-MM-DD format.");
  return listNcEntries(date);
});

export const postNcEntry = controller(async (req, res) => {
  const body: unknown = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new NcError("Request body must be a JSON object.");
  return createNcEntry({
    ...(body as Record<string, unknown>),
    recordedByEmail: signedInEmail(res),
  });
}, 201);

export const patchNcEntryStatus = controller(async (req, res) => {
  const id = req.params.id;
  if (typeof id !== "string" || !id.trim()) throw new NcError("NC entry ID is required.");
  const body: unknown = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new NcError("Request body must be a JSON object.");
  const input = body as Record<string, unknown>;
  return updateNcEntryStatus(id, input.status, input.reason, signedInEmail(res));
});
