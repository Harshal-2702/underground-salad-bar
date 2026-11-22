import type { Request, RequestHandler, Response } from "express";
import {
  defaultReportFilters,
  getReportDashboard,
  getReportEmailPreference,
  ReportError,
  saveReportEmailPreference,
  type ReportChannel,
} from "../services/reports.service.js";

function adminEmail(res: Response): string {
  const email = res.locals.adminEmail;
  if (typeof email !== "string" || !email.trim()) {
    throw new ReportError("Verified staff identity is missing.", 403);
  }
  return email.trim().toLowerCase();
}

function controller(action: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return async (req, res) => {
    try {
      res.status(200).json(await action(req, res));
    } catch (error) {
      if (error instanceof ReportError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      console.error("Reports request failed", {
        name: (error as { name?: string })?.name,
        code: (error as { code?: string })?.code,
      });
      res.status(500).json({ error: "Unable to load the report. Please try again." });
    }
  };
}

function queryValue(req: Request, key: string): string | undefined {
  const value = req.query[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > 20) {
    throw new ReportError(`${key} is invalid.`);
  }
  return value.trim();
}

export const getReports = controller(async (req) => {
  const defaults = defaultReportFilters();
  const channelValue = queryValue(req, "channel") ?? defaults.channel;
  if (!["ALL", "WEBSITE", "ZOMATO", "SWIGGY"].includes(channelValue)) {
    throw new ReportError("Order channel filter is invalid.");
  }
  return getReportDashboard({
    from: queryValue(req, "from") ?? defaults.from,
    to: queryValue(req, "to") ?? defaults.to,
    channel: channelValue as ReportChannel,
  });
});

export const getReportEmailSettings = controller(async () => ({
  preference: await getReportEmailPreference(),
  deliveryActive: false,
}));

export const putReportEmailSettings = controller(async (req, res) => {
  const body: unknown = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ReportError("Email settings must be a JSON object.");
  }
  const input = body as Record<string, unknown>;
  const preference = await saveReportEmailPreference(
    input.recipientEmail,
    input.deliveryTime,
    input.selectedReports,
    adminEmail(res),
  );
  // Email generation/scheduling is intentionally not implemented or activated.
  return { preference, deliveryActive: false };
});
