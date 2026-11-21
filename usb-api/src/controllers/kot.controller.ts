import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import {
  getKotTemplate,
  saveKotTemplate,
  type KotTemplateType,
  getKotChannelTimingSettings,
  saveKotChannelTimingSettings,
  KotValidationError,
} from "../services/kot.service.js";

function readTemplateType(value: unknown): KotTemplateType | null {
  if (value === undefined || value === null || value === "" || value === "KITCHEN") return "KITCHEN";
  if (value === "CUSTOMER") return "CUSTOMER";
  return null;
}

export async function getActiveKotTemplate(req: Request, res: Response) {
  try {
    const type = readTemplateType(req.query.type);
    if (!type) return res.status(400).json({ error: "Template type must be KITCHEN or CUSTOMER." });
    return res.json(await getKotTemplate(prisma, type));
  } catch (error) {
    console.error("KOT template read failed", { name: (error as any)?.name, code: (error as any)?.code });
    return res.status(500).json({ error: "Unable to load KOT template settings." });
  }
}

export async function createKotTemplateVersion(req: Request, res: Response) {
  try {
    const type = readTemplateType(req.body?.type);
    if (!type) return res.status(400).json({ error: "Template type must be KITCHEN or CUSTOMER." });
    const email = typeof res.locals.adminEmail === "string" ? res.locals.adminEmail : null;
    const version = await saveKotTemplate(prisma, req.body?.config, type, email);
    return res.status(201).json(version);
  } catch (error) {
    if (error instanceof KotValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error("KOT template save failed", { name: (error as any)?.name, code: (error as any)?.code });
    return res.status(500).json({ error: "Unable to save KOT template settings." });
  }
}


export async function getChannelTimingSettings(_req: Request, res: Response) {
  try {
    return res.json({ settings: await getKotChannelTimingSettings(prisma) });
  } catch (error) {
    console.error("KOT timing settings read failed", { name: (error as any)?.name, code: (error as any)?.code });
    return res.status(500).json({ error: "Unable to load KOT timing settings." });
  }
}

export async function putChannelTimingSettings(req: Request, res: Response) {
  try {
    const email = typeof res.locals.adminEmail === "string" ? res.locals.adminEmail : null;
    const settings = await saveKotChannelTimingSettings(prisma, req.body?.settings, email);
    return res.json({ settings });
  } catch (error) {
    if (error instanceof KotValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error("KOT timing settings save failed", { name: (error as any)?.name, code: (error as any)?.code });
    return res.status(500).json({ error: "Unable to save KOT timing settings." });
  }
}
