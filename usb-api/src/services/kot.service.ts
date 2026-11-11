import { Prisma, type PrismaClient } from "@prisma/client";
import type { OrderChannel, OrderStatus } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

export type KotTemplateConfig = {
  paperWidth: "58mm" | "80mm";
  headerText: string;
  footerText: string;
  showBrandName: boolean;
  showLogo: boolean;
  showKotNumber: true;
  showChannel: true;
  showReceivedAt: true;
  showExternalOrderReference: boolean;
  showCustomerFirstName: boolean;
  showItems: true;
  showIngredients: boolean;
  showSpecialInstructions: true;
  fontSize: number;
  headingWeight: "normal" | "bold";
  lineSpacing: "compact" | "normal" | "relaxed";
  margin: "narrow" | "normal" | "wide";
  alignment: "left" | "center";
};

export const DEFAULT_KOT_TEMPLATE: KotTemplateConfig = {
  paperWidth: "80mm",
  headerText: "UNDERGROUND KITCHEN",
  footerText: "Thank you",
  showBrandName: true,
  showLogo: false,
  showKotNumber: true,
  showChannel: true,
  showReceivedAt: true,
  showExternalOrderReference: true,
  showCustomerFirstName: true,
  showItems: true,
  showIngredients: true,
  showSpecialInstructions: true,
  fontSize: 12,
  headingWeight: "bold",
  lineSpacing: "normal",
  margin: "normal",
  alignment: "left",
};

export class KotValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KotValidationError";
  }
}

export function getIndiaBusinessDate(value = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function getIndiaDateRange(dateKey: string): { start: Date; end: Date } {
  if (!isDateKey(dateKey)) throw new KotValidationError("Date must use YYYY-MM-DD format.");
  const start = new Date(`${dateKey}T00:00:00.000+05:30`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export async function allocateKotIdentity(
  tx: TransactionClient,
  businessDate: string,
): Promise<{ kotNumber: string; kotBusinessDate: Date; kotSequence: number }> {
  if (!isDateKey(businessDate)) throw new KotValidationError("Invalid KOT business date.");

  const rows = await tx.$queryRaw<Array<{ lastSequence: number }>>(Prisma.sql`
    INSERT INTO "KotDailySequence" ("businessDate", "lastSequence", "updatedAt")
    VALUES (${businessDate}::date, 1, CURRENT_TIMESTAMP)
    ON CONFLICT ("businessDate")
    DO UPDATE SET
      "lastSequence" = "KotDailySequence"."lastSequence" + 1,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "lastSequence"
  `);

  const sequence = rows[0]?.lastSequence;
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error("Unable to allocate a daily KOT number.");
  }

  return {
    kotNumber: `KOT-${businessDate.replaceAll("-", "")}-${String(sequence).padStart(3, "0")}`,
    kotBusinessDate: new Date(`${businessDate}T00:00:00.000Z`),
    kotSequence: sequence,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateKotTemplateConfig(value: unknown): KotTemplateConfig {
  if (!isRecord(value)) throw new KotValidationError("KOT template settings are invalid.");

  const paperWidth = value.paperWidth;
  const headerText = value.headerText;
  const footerText = value.footerText;
  const fontSize = value.fontSize;
  const lineSpacing = value.lineSpacing;
  const margin = value.margin;
  const headingWeight = value.headingWeight;
  const alignment = value.alignment;

  if (paperWidth !== "58mm" && paperWidth !== "80mm") {
    throw new KotValidationError("Choose a supported paper width.");
  }
  if (typeof headerText !== "string" || headerText.trim().length > 80) {
    throw new KotValidationError("Header text must be 80 characters or fewer.");
  }
  if (typeof footerText !== "string" || footerText.length > 160) {
    throw new KotValidationError("Footer text must be 160 characters or fewer.");
  }
  if (!Number.isInteger(fontSize) || Number(fontSize) < 10 || Number(fontSize) > 18) {
    throw new KotValidationError("Font size must be between 10 and 18.");
  }
  if (lineSpacing !== "compact" && lineSpacing !== "normal" && lineSpacing !== "relaxed") {
    throw new KotValidationError("Choose a valid line spacing.");
  }
  if (margin !== "narrow" && margin !== "normal" && margin !== "wide") {
    throw new KotValidationError("Choose a valid print margin.");
  }
  if (headingWeight !== "normal" && headingWeight !== "bold") {
    throw new KotValidationError("Choose a valid heading weight.");
  }
  if (alignment !== "left" && alignment !== "center") {
    throw new KotValidationError("Choose a valid alignment.");
  }

  const optionalFlags = [
    "showBrandName",
    "showLogo",
    "showExternalOrderReference",
    "showCustomerFirstName",
    "showIngredients",
  ] as const;
  for (const key of optionalFlags) {
    if (typeof value[key] !== "boolean") {
      throw new KotValidationError(`KOT setting ${key} must be true or false.`);
    }
  }

  // Critical ticket fields are enforced server-side and cannot be hidden.
  return {
    paperWidth,
    headerText: headerText.trim(),
    footerText: footerText.trim(),
    showBrandName: value.showBrandName as boolean,
    showLogo: value.showLogo as boolean,
    showKotNumber: true,
    showChannel: true,
    showReceivedAt: true,
    showExternalOrderReference: value.showExternalOrderReference as boolean,
    showCustomerFirstName: value.showCustomerFirstName as boolean,
    showItems: true,
    showIngredients: value.showIngredients as boolean,
    showSpecialInstructions: true,
    fontSize: Number(fontSize),
    headingWeight,
    lineSpacing,
    margin,
    alignment,
  };
}

export async function getKotTemplate(prisma: PrismaClient) {
  const template = await prisma.kotTemplate.findUnique({
    where: { code: "DEFAULT" },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 10,
      },
    },
  });

  if (!template) {
    return {
      template: { code: "DEFAULT", name: "Default Kitchen KOT" },
      current: { versionNumber: 0, config: DEFAULT_KOT_TEMPLATE, isActive: true, createdAt: null },
      history: [],
    };
  }

  const active = template.versions.find((version) => version.isActive);
  return {
    template: { code: template.code, name: template.name },
    current: active
      ? { versionNumber: active.versionNumber, config: active.config, isActive: true, createdAt: active.createdAt }
      : { versionNumber: 0, config: DEFAULT_KOT_TEMPLATE, isActive: true, createdAt: null },
    history: template.versions.map((version) => ({
      id: version.id,
      versionNumber: version.versionNumber,
      isActive: version.isActive,
      createdAt: version.createdAt,
      createdByEmail: version.createdByEmail,
    })),
  };
}

export async function saveKotTemplate(
  prisma: PrismaClient,
  input: unknown,
  createdByEmail?: string | null,
) {
  const config = validateKotTemplateConfig(input);

  return prisma.$transaction(async (tx) => {
    const template = await tx.kotTemplate.upsert({
      where: { code: "DEFAULT" },
      create: { code: "DEFAULT", name: "Default Kitchen KOT" },
      update: {},
    });

    const aggregate = await tx.kotTemplateVersion.aggregate({
      where: { templateId: template.id },
      _max: { versionNumber: true },
    });
    const versionNumber = (aggregate._max.versionNumber ?? 0) + 1;

    await tx.kotTemplateVersion.updateMany({
      where: { templateId: template.id, isActive: true },
      data: { isActive: false },
    });

    const version = await tx.kotTemplateVersion.create({
      data: {
        templateId: template.id,
        versionNumber,
        config: config as Prisma.InputJsonValue,
        isActive: true,
        createdByEmail: createdByEmail?.slice(0, 255) ?? null,
      },
    });

    return {
      versionNumber: version.versionNumber,
      config: version.config,
      isActive: version.isActive,
      createdAt: version.createdAt,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  // The kitchen has three visible stages: NEW (PENDING), ACCEPTED (CONFIRMED),
  // and READY. PREPARING remains a legacy persisted value and can finish at READY,
  // but new orders no longer enter it. OUT_FOR_DELIVERY is the handover outcome.
  const transitions: Record<OrderStatus, OrderStatus[]> = {
    PENDING: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["READY", "CANCELLED"],
    PREPARING: ["READY", "CANCELLED"],
    READY: ["OUT_FOR_DELIVERY"],
    OUT_FOR_DELIVERY: ["DELIVERED"],
    DELIVERED: [],
    CANCELLED: [],
  };
  return transitions[from].includes(to);
}

export type KitchenOrderStatusFilter = "ALL" | "NEW" | "ACCEPTED" | "READY" | "HANDED_OVER" | "CANCELLED";

/** Translate the three-stage kitchen vocabulary to the legacy persisted enum. */
export function getKitchenOrderStatusWhere(value: string): Prisma.OrderWhereInput | null {
  switch (value) {
    case "ALL": return {};
    case "NEW": return { status: "PENDING" };
    case "ACCEPTED": return { status: { in: ["CONFIRMED", "PREPARING"] } };
    case "READY": return { status: "READY" };
    case "HANDED_OVER": return { status: { in: ["OUT_FOR_DELIVERY", "DELIVERED"] } };
    case "CANCELLED": return { status: "CANCELLED" };
    default: return null;
  }
}


export type KotChannelTimingSettingInput = {
  channel: OrderChannel;
  acceptanceAmberMinutes: number | null;
  acceptanceLateMinutes: number | null;
  preparationAmberMinutes: number | null;
  preparationLateMinutes: number | null;
};

const KOT_CHANNELS: OrderChannel[] = ["WEBSITE", "ZOMATO", "SWIGGY"];

function parseOptionalThreshold(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > 1440) {
    throw new KotValidationError(`${label} must be a whole number between 1 and 1440 minutes, or left blank.`);
  }
  return value;
}

function validateThresholdPair(amber: number | null, late: number | null, label: string) {
  if ((amber === null) !== (late === null)) {
    throw new KotValidationError(`Configure both amber and late thresholds for ${label}, or leave both blank.`);
  }
  if (amber !== null && late !== null && late <= amber) {
    throw new KotValidationError(`The late threshold must be greater than the amber threshold for ${label}.`);
  }
}

export function validateKotChannelTimingSettings(value: unknown): KotChannelTimingSettingInput[] {
  if (!Array.isArray(value) || value.length !== KOT_CHANNELS.length) {
    throw new KotValidationError("Timing settings must contain Website, Zomato and Swiggy exactly once.");
  }

  const seen = new Set<string>();
  const settings = value.map((entry, index) => {
    if (!isRecord(entry)) throw new KotValidationError(`Timing setting ${index + 1} is invalid.`);
    const channel = entry.channel;
    if (typeof channel !== "string" || !KOT_CHANNELS.includes(channel as OrderChannel) || seen.has(channel)) {
      throw new KotValidationError("Each order channel must appear exactly once in timing settings.");
    }
    seen.add(channel);

    const acceptanceAmberMinutes = parseOptionalThreshold(entry.acceptanceAmberMinutes, `${channel} acceptance amber threshold`);
    const acceptanceLateMinutes = parseOptionalThreshold(entry.acceptanceLateMinutes, `${channel} acceptance late threshold`);
    const preparationAmberMinutes = parseOptionalThreshold(entry.preparationAmberMinutes, `${channel} preparation amber threshold`);
    const preparationLateMinutes = parseOptionalThreshold(entry.preparationLateMinutes, `${channel} preparation late threshold`);

    validateThresholdPair(acceptanceAmberMinutes, acceptanceLateMinutes, `${channel} acceptance`);
    validateThresholdPair(preparationAmberMinutes, preparationLateMinutes, `${channel} preparation`);

    return {
      channel: channel as OrderChannel,
      acceptanceAmberMinutes,
      acceptanceLateMinutes,
      preparationAmberMinutes,
      preparationLateMinutes,
    };
  });

  if (KOT_CHANNELS.some((channel) => !seen.has(channel))) {
    throw new KotValidationError("Website, Zomato and Swiggy timing settings are all required.");
  }
  return settings;
}

export async function getKotChannelTimingSettings(prisma: PrismaClient) {
  await prisma.kotChannelTimingSetting.createMany({
    data: KOT_CHANNELS.map((channel) => ({ channel })),
    skipDuplicates: true,
  });
  return prisma.kotChannelTimingSetting.findMany({ orderBy: { channel: "asc" } });
}

export async function saveKotChannelTimingSettings(
  prisma: PrismaClient,
  input: unknown,
  updatedByEmail?: string | null,
) {
  const settings = validateKotChannelTimingSettings(input);
  return prisma.$transaction(async (tx) => {
    const saved = [];
    for (const setting of settings) {
      saved.push(await tx.kotChannelTimingSetting.upsert({
        where: { channel: setting.channel },
        create: { ...setting, updatedByEmail: updatedByEmail?.slice(0, 255) ?? null },
        update: { ...setting, updatedByEmail: updatedByEmail?.slice(0, 255) ?? null },
      }));
    }
    return saved;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export type OrderTimingSnapshot = {
  status: OrderStatus;
  createdAt: Date;
  acceptedAt: Date | null;
};

function elapsedWholeSeconds(start: Date, end: Date): number {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
}

/** Build timestamp/duration fields for a status transition using one server timestamp. */
export function buildOrderTimingUpdate(
  current: OrderTimingSnapshot,
  nextStatus: OrderStatus,
  changedAt: Date,
): Prisma.OrderUpdateManyMutationInput {
  const data: Prisma.OrderUpdateManyMutationInput = {};

  if (current.status === "PENDING" && nextStatus === "CONFIRMED") {
    data.acceptedAt = changedAt;
    data.acceptanceDurationSeconds = elapsedWholeSeconds(current.createdAt, changedAt);
  }

  if ((current.status === "CONFIRMED" || current.status === "PREPARING") && nextStatus === "READY") {
    data.readyAt = changedAt;
    // Legacy accepted orders without a recorded acceptance event remain explicitly unknown.
    data.preparationDurationSeconds = current.acceptedAt
      ? elapsedWholeSeconds(current.acceptedAt, changedAt)
      : null;
  }

  if (current.status === "READY" && nextStatus === "OUT_FOR_DELIVERY") {
    data.handedOverAt = changedAt;
  }

  if (nextStatus === "CANCELLED") {
    data.cancelledAt = changedAt;
    if (current.status === "CONFIRMED" || current.status === "PREPARING") {
      data.preparationDurationSeconds = current.acceptedAt
        ? elapsedWholeSeconds(current.acceptedAt, changedAt)
        : null;
    }
  }

  return data;
}

export type KotTimerSeverity = "NEUTRAL" | "AMBER" | "LATE" | "UNCONFIGURED";

export function getKotTimerSeverity(
  elapsedSeconds: number,
  amberMinutes: number | null,
  lateMinutes: number | null,
): KotTimerSeverity {
  if (amberMinutes === null || lateMinutes === null) return "UNCONFIGURED";
  if (elapsedSeconds >= lateMinutes * 60) return "LATE";
  if (elapsedSeconds >= amberMinutes * 60) return "AMBER";
  return "NEUTRAL";
}
