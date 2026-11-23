import {
  NCConsumerType,
  NCMode,
  NCPurpose,
  NCStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { calculateNcMenuPricing } from "./pricing.js";
import { getIndiaBusinessDate, isDateKey } from "./kot.service.js";

export class NcError extends Error {
  constructor(message: string, public readonly statusCode: 400 | 404 | 409 = 400) {
    super(message);
    this.name = "NcError";
  }
}

function cleanText(value: unknown, field: string, maxLength: number, required = true): string | null {
  if (value === undefined || value === null) {
    if (required) throw new NcError(field + " is required.");
    return null;
  }
  if (typeof value !== "string") throw new NcError(field + " must be text.");
  const trimmed = value.trim();
  if (required && !trimmed) throw new NcError(field + " is required.");
  if (trimmed.length > maxLength) throw new NcError(field + " cannot exceed " + maxLength + " characters.");
  return trimmed || null;
}

function enumValue<T extends Record<string, string>>(enumObject: T, value: unknown, field: string): T[keyof T] {
  if (typeof value !== "string" || !Object.values(enumObject).includes(value)) {
    throw new NcError("Select a valid " + field + ".");
  }
  return value as T[keyof T];
}

function dateValue(value: string): Date {
  if (!isDateKey(value)) throw new NcError("Date must use YYYY-MM-DD format.");
  return new Date(value + "T00:00:00.000Z");
}

const entryInclude = {
  items: { orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }] },
};

export async function createNcEntry(input: {
  consumerName: unknown;
  consumerType: unknown;
  purpose: unknown;
  mode: unknown;
  notes: unknown;
  items: unknown;
  recordedByEmail: string;
}) {
  const consumerName = cleanText(input.consumerName, "Person consuming", 120);
  const notes = cleanText(input.notes, "Notes", 1000, false);
  const consumerType = enumValue(NCConsumerType, input.consumerType, "consumer type");
  const purpose = enumValue(NCPurpose, input.purpose, "NC purpose");
  const mode = enumValue(NCMode, input.mode, "consumption mode");
  const pricing = calculateNcMenuPricing(input.items);
  const businessDate = getIndiaBusinessDate();

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ lastSequence: number }>>(Prisma.sql`
      INSERT INTO "NCDailySequence" ("businessDate", "lastSequence", "updatedAt")
      VALUES (${businessDate}::date, 1, CURRENT_TIMESTAMP)
      ON CONFLICT ("businessDate")
      DO UPDATE SET
        "lastSequence" = "NCDailySequence"."lastSequence" + 1,
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING "lastSequence"
    `);
    const sequence = rows[0]?.lastSequence;
    if (!Number.isInteger(sequence) || sequence < 1) {
      throw new Error("Unable to allocate a daily NC reference.");
    }
    const reference = "NC-" + businessDate.replaceAll("-", "") + "-" + String(sequence).padStart(3, "0");
    const now = new Date();
    const completedImmediately = mode === NCMode.ALREADY_CONSUMED;

    return tx.nCConsumptionEntry.create({
      data: {
        reference,
        businessDate: dateValue(businessDate),
        sequence,
        purpose,
        mode,
        status: completedImmediately ? NCStatus.COMPLETED : NCStatus.QUEUED,
        consumerType,
        consumerName: consumerName!,
        notes,
        recordedByEmail: input.recordedByEmail,
        menuValue: pricing.totalMenuValue,
        completedAt: completedImmediately ? now : null,
        items: {
          create: pricing.items.map((item, index) => ({
            categoryIdSnapshot: item.category,
            categoryNameSnapshot: item.categoryNameSnapshot,
            itemNameSnapshot: item.itemName,
            scoops: item.scoops,
            unitPriceSnapshot: item.unitPrice,
            lineValue: item.lineValue,
            ...(item.selectedOptions ? { selectedOptions: item.selectedOptions as Prisma.InputJsonValue } : {}),
            sortOrder: index,
          })),
        },
      },
      include: entryInclude,
    });
  });
}

export async function listNcEntries(dateKey = getIndiaBusinessDate()) {
  const businessDate = dateValue(dateKey);
  return prisma.nCConsumptionEntry.findMany({
    where: { businessDate },
    orderBy: [{ sequence: "desc" }],
    take: 200,
    include: entryInclude,
  });
}

export async function updateNcEntryStatus(
  entryId: string,
  statusInput: unknown,
  reasonInput: unknown,
  actorEmail: string,
) {
  const status = enumValue(NCStatus, statusInput, "NC status");
  const reason = cleanText(reasonInput, "Void reason", 500, status === NCStatus.VOIDED);

  const current = await prisma.nCConsumptionEntry.findUnique({
    where: { id: entryId },
    select: { id: true, status: true, mode: true },
  });
  if (!current) throw new NcError("NC entry was not found.", 404);
  if (current.status === NCStatus.VOIDED) throw new NcError("Voided NC entries cannot be changed.", 409);
  if (current.mode === NCMode.ALREADY_CONSUMED && status !== NCStatus.VOIDED) {
    throw new NcError("An already-consumed entry is complete and cannot be moved through the preparation queue.", 409);
  }

  if (status === NCStatus.VOIDED) {
    return prisma.nCConsumptionEntry.update({
      where: { id: entryId },
      data: { status, voidedAt: new Date(), voidedByEmail: actorEmail, voidReason: reason },
      include: entryInclude,
    });
  }

  if (current.status === NCStatus.COMPLETED) throw new NcError("Completed NC entries cannot be reopened.", 409);
  const transitions: Record<string, NCStatus[]> = {
    [NCStatus.QUEUED]: [NCStatus.PREPARING, NCStatus.READY, NCStatus.COMPLETED],
    [NCStatus.PREPARING]: [NCStatus.READY, NCStatus.COMPLETED],
    [NCStatus.READY]: [NCStatus.COMPLETED],
  };
  if (!transitions[current.status]?.includes(status)) {
    throw new NcError("That NC preparation status change is not allowed.", 409);
  }

  return prisma.nCConsumptionEntry.update({
    where: { id: entryId },
    data: { status, ...(status === NCStatus.COMPLETED ? { completedAt: new Date() } : {}) },
    include: entryInclude,
  });
}
