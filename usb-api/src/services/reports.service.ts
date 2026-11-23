import { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getIndiaBusinessDate, isDateKey } from "./india-date.js";

export const REPORT_IDS = ["overview", "sales", "kitchen", "purchases", "inventory", "audit", "nc"] as const;
export type ReportId = (typeof REPORT_IDS)[number];
export type ReportChannel = "ALL" | "WEBSITE" | "ZOMATO" | "SWIGGY";

export class ReportError extends Error {
  constructor(message: string, public readonly statusCode: 400 | 403 = 400) {
    super(message);
    this.name = "ReportError";
  }
}

export type ReportFilters = { from: string; to: string; channel: ReportChannel };

function nextDate(dateKey: string): string {
  const date = new Date(dateKey + "T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function dateRange(from: string, to: string) {
  if (!isDateKey(from) || !isDateKey(to)) throw new ReportError("Dates must use YYYY-MM-DD format.");
  const fromUtc = new Date(from + "T00:00:00.000Z");
  const toUtc = new Date(to + "T00:00:00.000Z");
  const days = Math.floor((toUtc.getTime() - fromUtc.getTime()) / 86400000) + 1;
  if (days < 1) throw new ReportError("Start date cannot be after end date.");
  if (days > 366) throw new ReportError("Choose a reporting period of 366 days or fewer.");
  return {
    days,
    orderStart: new Date(from + "T00:00:00.000+05:30"),
    orderEnd: new Date(nextDate(to) + "T00:00:00.000+05:30"),
    dateStart: fromUtc,
    dateEnd: new Date(nextDate(to) + "T00:00:00.000Z"),
    toDate: toUtc,
  };
}

function indiaDateKey(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(value);
  const part = (kind: string) => parts.find((item) => item.type === kind)?.value ?? "";
  return part("year") + "-" + part("month") + "-" + part("day");
}

function indiaWeekday(value: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "long" }).format(value);
}

function indiaHour(value: Date): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", hour: "2-digit", hourCycle: "h23",
  }).format(value);
  return Number(hour);
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function money(value: Prisma.Decimal | number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function classifySla(
  seconds: number,
  amberMinutes: number | null | undefined,
  lateMinutes: number | null | undefined,
): "WITHIN" | "AMBER" | "LATE" | "UNCONFIGURED" {
  if (amberMinutes == null || lateMinutes == null) return "UNCONFIGURED";
  if (seconds >= lateMinutes * 60) return "LATE";
  if (seconds >= amberMinutes * 60) return "AMBER";
  return "WITHIN";
}

function addGroup(map: Map<string, { label: string; count: number; amount: number }>, key: string, label: string, amount: number) {
  const group = map.get(key) ?? { label, count: 0, amount: 0 };
  group.count += 1;
  group.amount += amount;
  map.set(key, group);
}

function sortedGroups(map: Map<string, { label: string; count: number; amount: number }>) {
  return [...map.values()].sort((a, b) => b.amount - a.amount || b.count - a.count);
}

export async function getReportDashboard(filters: ReportFilters) {
  if (!["ALL", "WEBSITE", "ZOMATO", "SWIGGY"].includes(filters.channel)) {
    throw new ReportError("Order channel filter is invalid.");
  }
  const range = dateRange(filters.from, filters.to);
  const orderWhere: Prisma.OrderWhereInput = {
    createdAt: { gte: range.orderStart, lt: range.orderEnd },
    ...(filters.channel !== "ALL" ? { channel: filters.channel } : {}),
  };
  const purchaseWhere: Prisma.PurchaseTransactionWhereInput = {
    sheets: { some: { purchaseDate: { gte: range.dateStart, lt: range.dateEnd } } },
  };

  const [ordersRaw, purchaseTransactionsRaw, latestStocktake, stocktakeHistory, timingSettings, totalOrderCount, orderStatusAggregates, channelStatusAggregates, orderTimingAggregates, ncEntriesRaw] = await Promise.all([
    prisma.order.findMany({
      where: orderWhere,
      orderBy: [{ createdAt: "desc" }, { kotSequence: "desc" }],
      take: 5001,
      select: {
        id: true, invoiceNumber: true, kotNumber: true, channel: true, externalOrderId: true,
        total: true, deliveryCharge: true, paymentMethod: true, status: true, createdAt: true,
        acceptedAt: true, readyAt: true, handedOverAt: true, cancelledAt: true,
        acceptanceDurationSeconds: true, preparationDurationSeconds: true,
        deliveryArea: true, deliveryCity: true,
        bowls: { select: { quantity: true } },
      },
    }),
    prisma.purchaseTransaction.findMany({
      where: purchaseWhere,
      orderBy: { createdAt: "desc" },
      take: 5001,
      select: {
        id: true, reference: true, recordedByName: true, recordedByEmail: true,
        totalAmount: true, createdAt: true, voidedAt: true, voidedByEmail: true, voidReason: true,
        sheets: {
          where: { purchaseDate: { gte: range.dateStart, lt: range.dateEnd } },
          orderBy: [{ purchaseDate: "asc" }, { inventoryCategoryNameSnapshot: "asc" }],
          select: {
            purchaseDate: true, supplierName: true, invoiceNumber: true,
            inventoryCategoryNameSnapshot: true,
            lines: {
              orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
              select: {
                ingredientNameSnapshot: true, ingredientCodeSnapshot: true,
                purchaseUnitSymbolSnapshot: true, quantity: true, itemAmount: true,
              },
            },
          },
        },
      },
    }),
    prisma.leftoverInventoryTransaction.findFirst({
      where: { stocktakeDate: { lte: range.toDate } },
      orderBy: [{ stocktakeDate: "desc" }, { createdAt: "desc" }],
      include: { lines: { orderBy: [{ inventoryCategoryNameSnapshot: "asc" }, { sortOrder: "asc" }] } },
    }),
    prisma.leftoverInventoryTransaction.findMany({
      where: { stocktakeDate: { gte: range.dateStart, lt: range.dateEnd } },
      orderBy: [{ stocktakeDate: "desc" }, { createdAt: "desc" }],
      take: 100,
      select: {
        id: true, stocktakeDate: true, createdAt: true, recordedByName: true,
        recordedByEmail: true, _count: { select: { lines: true } },
      },
    }),
    prisma.kotChannelTimingSetting.findMany(),
    prisma.order.count({ where: orderWhere }),
    prisma.order.groupBy({ by: ["status"], where: orderWhere, _count: { _all: true }, _sum: { total: true, deliveryCharge: true } }),
    prisma.order.groupBy({ by: ["channel", "status"], where: orderWhere, _count: { _all: true }, _sum: { total: true } }),
    prisma.order.aggregate({
      where: { ...orderWhere, status: { not: "CANCELLED" } },
      _avg: { acceptanceDurationSeconds: true, preparationDurationSeconds: true },
      _count: { acceptanceDurationSeconds: true, preparationDurationSeconds: true },
    }),
    prisma.nCConsumptionEntry.findMany({
      where: { businessDate: { gte: range.dateStart, lt: range.dateEnd } },
      orderBy: [{ businessDate: "desc" }, { sequence: "desc" }],
      take: 5001,
      include: { items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    }),
  ]);

  const orders = ordersRaw.slice(0, 5000);
  const purchaseTransactions = purchaseTransactionsRaw.slice(0, 5000);
  const ncEntries = ncEntriesRaw.slice(0, 5000);
  const hasMoreOrders = ordersRaw.length > 5000;
  const hasMorePurchases = purchaseTransactionsRaw.length > 5000;
  const now = new Date();

  const statusCounts: Record<string, number> = {};
  for (const status of Object.values(OrderStatus)) statusCounts[status] = 0;
  const areaMap = new Map<string, { label: string; count: number; amount: number }>();
  const trendMap = new Map<string, { date: string; orders: number; orderValue: number; cancelled: number }>();
  const hourMap = new Map<number, number>();
  const weekdayMap = new Map<string, { label: string; count: number; orderValue: number }>();
  const acceptanceDurations: number[] = [];
  const preparationDurations: number[] = [];
  const handoverDurations: number[] = [];
  const channelOperations = new Map<string, { acceptance: number[]; preparation: number[]; handover: number[] }>();
  const acceptanceSla = { within: 0, amber: 0, late: 0, unconfigured: 0 };
  const preparationSla = { within: 0, amber: 0, late: 0, unconfigured: 0 };
  const activeLateOrders: Array<Record<string, unknown>> = [];
  const settingsByChannel = new Map(timingSettings.map((setting) => [setting.channel, setting]));
  for (const status of Object.values(OrderStatus)) statusCounts[status] = 0;
  for (const group of orderStatusAggregates) statusCounts[group.status] = group._count._all;
  const exactCancelledGroup = orderStatusAggregates.find((group) => group.status === "CANCELLED");
  const exactCancelledCount = exactCancelledGroup?._count._all ?? 0;
  const exactCancelledValue = money(exactCancelledGroup?._sum.total);
  const exactNonCancelledGroups = orderStatusAggregates.filter((group) => group.status !== "CANCELLED");
  const exactNonCancelledCount = exactNonCancelledGroups.reduce((sum, group) => sum + group._count._all, 0);
  const exactOrderValue = exactNonCancelledGroups.reduce((sum, group) => sum + money(group._sum.total), 0);
  const exactDeliveryCharges = exactNonCancelledGroups.reduce((sum, group) => sum + money(group._sum.deliveryCharge), 0);
  for (const order of orders) {
    // Aggregate status totals are loaded separately without the detail-row cap.
    const isCancelled = order.status === "CANCELLED";
    const total = money(order.total);
    const dayKey = indiaDateKey(order.createdAt);
    const trend = trendMap.get(dayKey) ?? { date: dayKey, orders: 0, orderValue: 0, cancelled: 0 };
    trend.orders += 1;
    if (isCancelled) {
      trend.cancelled += 1;
    } else {
      trend.orderValue += total;
    }
    trendMap.set(dayKey, trend);

    if (order.deliveryArea?.trim()) addGroup(areaMap, order.deliveryArea.trim().toLowerCase(), order.deliveryArea.trim(), isCancelled ? 0 : total);
    const hour = indiaHour(order.createdAt);
    hourMap.set(hour, (hourMap.get(hour) ?? 0) + 1);
    const weekday = indiaWeekday(order.createdAt);
    const weekdayGroup = weekdayMap.get(weekday) ?? { label: weekday, count: 0, orderValue: 0 };
    weekdayGroup.count += 1;
    if (!isCancelled) weekdayGroup.orderValue += total;
    weekdayMap.set(weekday, weekdayGroup);

    const setting = settingsByChannel.get(order.channel);
    const channelTiming = channelOperations.get(order.channel) ?? { acceptance: [], preparation: [], handover: [] };
    if (!isCancelled && order.acceptanceDurationSeconds != null) channelTiming.acceptance.push(order.acceptanceDurationSeconds);
    if (!isCancelled && order.preparationDurationSeconds != null) channelTiming.preparation.push(order.preparationDurationSeconds);
    if (!isCancelled && order.readyAt && order.handedOverAt) channelTiming.handover.push(Math.max(0, Math.floor((order.handedOverAt.getTime() - order.readyAt.getTime()) / 1000)));
    channelOperations.set(order.channel, channelTiming);

    if (!isCancelled && order.acceptanceDurationSeconds != null) {
      acceptanceDurations.push(order.acceptanceDurationSeconds);
      const state = classifySla(order.acceptanceDurationSeconds, setting?.acceptanceAmberMinutes, setting?.acceptanceLateMinutes);
      acceptanceSla[state === "WITHIN" ? "within" : state === "AMBER" ? "amber" : state === "LATE" ? "late" : "unconfigured"] += 1;
    } else if (!isCancelled && order.status !== "PENDING") {
      acceptanceSla.unconfigured += 1;
    }

    if (!isCancelled && order.preparationDurationSeconds != null) {
      preparationDurations.push(order.preparationDurationSeconds);
      const state = classifySla(order.preparationDurationSeconds, setting?.preparationAmberMinutes, setting?.preparationLateMinutes);
      preparationSla[state === "WITHIN" ? "within" : state === "AMBER" ? "amber" : state === "LATE" ? "late" : "unconfigured"] += 1;
    } else if (!isCancelled && order.readyAt) {
      preparationSla.unconfigured += 1;
    }

    if (!isCancelled && order.readyAt && order.handedOverAt) {
      handoverDurations.push(Math.max(0, Math.floor((order.handedOverAt.getTime() - order.readyAt.getTime()) / 1000)));
    }

    if (!isCancelled && order.status === "PENDING") {
      const elapsed = Math.max(0, Math.floor((now.getTime() - order.createdAt.getTime()) / 1000));
      const lateAt = setting?.acceptanceLateMinutes;
      const amberAt = setting?.acceptanceAmberMinutes;
      if (lateAt != null && elapsed >= lateAt * 60) {
        activeLateOrders.push({
          kotNumber: order.kotNumber, invoiceNumber: order.invoiceNumber,
          channel: order.channel, status: order.status, stage: "Acceptance",
          elapsedSeconds: elapsed, lateThresholdMinutes: lateAt, createdAt: order.createdAt,
        });
      } else if (amberAt != null && elapsed >= amberAt * 60) {
        activeLateOrders.push({
          kotNumber: order.kotNumber, invoiceNumber: order.invoiceNumber,
          channel: order.channel, status: order.status, stage: "Acceptance (Amber)",
          elapsedSeconds: elapsed, lateThresholdMinutes: lateAt, createdAt: order.createdAt,
        });
      }
    }

    if (!isCancelled && (order.status === "CONFIRMED" || order.status === "PREPARING") && order.acceptedAt) {
      const elapsed = Math.max(0, Math.floor((now.getTime() - order.acceptedAt.getTime()) / 1000));
      const lateAt = setting?.preparationLateMinutes;
      const amberAt = setting?.preparationAmberMinutes;
      if (lateAt != null && elapsed >= lateAt * 60) {
        activeLateOrders.push({
          kotNumber: order.kotNumber, invoiceNumber: order.invoiceNumber,
          channel: order.channel, status: order.status, stage: "Preparation",
          elapsedSeconds: elapsed, lateThresholdMinutes: lateAt, createdAt: order.createdAt,
        });
      } else if (amberAt != null && elapsed >= amberAt * 60) {
        activeLateOrders.push({
          kotNumber: order.kotNumber, invoiceNumber: order.invoiceNumber,
          channel: order.channel, status: order.status, stage: "Preparation (Amber)",
          elapsedSeconds: elapsed, lateThresholdMinutes: lateAt, createdAt: order.createdAt,
        });
      }
    }
  }

  const trend = [];
  const cursor = new Date(range.dateStart);
  for (let index = 0; index < range.days; index += 1) {
    const key = cursor.toISOString().slice(0, 10);
    const existing = trendMap.get(key);
    trend.push(existing ?? { date: key, orders: 0, orderValue: 0, cancelled: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const channelAggregates = new Map<string, { count: number; nonCancelledCount: number; orderValue: number; cancelled: number }>();
  for (const group of channelStatusAggregates) {
    const aggregate = channelAggregates.get(group.channel) ?? { count: 0, nonCancelledCount: 0, orderValue: 0, cancelled: 0 };
    aggregate.count += group._count._all;
    if (group.status === "CANCELLED") aggregate.cancelled += group._count._all;
    else {
      aggregate.nonCancelledCount += group._count._all;
      aggregate.orderValue += money(group._sum.total);
    }
    channelAggregates.set(group.channel, aggregate);
  }
  const channelMix = ["WEBSITE", "ZOMATO", "SWIGGY"].map((channel) => {
    const group = channelAggregates.get(channel) ?? { count: 0, nonCancelledCount: 0, orderValue: 0, cancelled: 0 };
    return { channel, label: channel === "WEBSITE" ? "Website" : channel === "ZOMATO" ? "Zomato" : "Swiggy", count: group.count, nonCancelledCount: group.nonCancelledCount, orderValue: group.orderValue, averageOrderValue: group.nonCancelledCount ? group.orderValue / group.nonCancelledCount : 0, cancelled: group.cancelled };
  });
  const areaMix = sortedGroups(areaMap);
  const peakHours = [...hourMap.entries()].map(([hour, count]) => ({ hour, label: String(hour).padStart(2, "0") + ":00", count })).sort((a, b) => b.count - a.count);
  const busiestDays = [...weekdayMap.values()].sort((a, b) => b.count - a.count);
  const longestPreparation = orders
    .filter((order) => order.status !== "CANCELLED" && order.preparationDurationSeconds != null)
    .sort((a, b) => (b.preparationDurationSeconds ?? 0) - (a.preparationDurationSeconds ?? 0))
    .slice(0, 12)
    .map((order) => ({
      kotNumber: order.kotNumber, invoiceNumber: order.invoiceNumber, channel: order.channel,
      preparationSeconds: order.preparationDurationSeconds, status: order.status, createdAt: order.createdAt,
    }));

  const purchaseCategoryMap = new Map<string, { label: string; count: number; amount: number }>();
  const purchaseSupplierMap = new Map<string, { label: string; count: number; amount: number }>();
  const purchaseIngredientMap = new Map<string, { label: string; unit: string; quantity: number; amount: number; unitPrice: number }>();
  const purchaseTrendMap = new Map<string, { date: string; amount: number; lineCount: number }>();
  const purchaseLines: Array<Record<string, unknown>> = [];
  let purchaseSpend = 0;
  let activePurchaseCount = 0;
  let voidedPurchaseCount = 0;
  const voidedTransactions: Array<Record<string, unknown>> = [];

  for (const transaction of purchaseTransactions) {
    if (transaction.voidedAt) {
      voidedPurchaseCount += 1;
      voidedTransactions.push({
        reference: transaction.reference, totalAmount: transaction.sheets.reduce((sheetTotal, sheet) => sheetTotal + sheet.lines.reduce((lineTotal, line) => lineTotal + money(line.itemAmount), 0), 0),
        voidedAt: transaction.voidedAt, voidedByEmail: transaction.voidedByEmail,
        voidReason: transaction.voidReason, createdAt: transaction.createdAt,
      });
    } else {
      activePurchaseCount += 1;
    }
    for (const sheet of transaction.sheets) {
      const purchaseDate = sheet.purchaseDate.toISOString().slice(0, 10);
      for (const line of sheet.lines) {
        const quantity = money(line.quantity);
        const amount = money(line.itemAmount);
        const unit = line.purchaseUnitSymbolSnapshot;
        const ingredientKey = line.ingredientCodeSnapshot + "|" + unit;
        if (!transaction.voidedAt) {
          const ingredientGroup = purchaseIngredientMap.get(ingredientKey) ?? {
            label: line.ingredientNameSnapshot, unit, quantity: 0, amount: 0, unitPrice: 0,
          };
          ingredientGroup.quantity += quantity;
          ingredientGroup.amount += amount;
          purchaseSpend += amount;
          const purchaseTrend = purchaseTrendMap.get(purchaseDate) ?? { date: purchaseDate, amount: 0, lineCount: 0 };
          purchaseTrend.amount += amount;
          purchaseTrend.lineCount += 1;
          purchaseTrendMap.set(purchaseDate, purchaseTrend);
          addGroup(purchaseCategoryMap, sheet.inventoryCategoryNameSnapshot, sheet.inventoryCategoryNameSnapshot, amount);
          addGroup(purchaseSupplierMap, sheet.supplierName.toLowerCase(), sheet.supplierName, amount);
          ingredientGroup.unitPrice = ingredientGroup.quantity > 0 ? ingredientGroup.amount / ingredientGroup.quantity : 0;
          purchaseIngredientMap.set(ingredientKey, ingredientGroup);
        }
        purchaseLines.push({
          reference: transaction.reference, purchaseDate, supplier: sheet.supplierName,
          invoiceNumber: sheet.invoiceNumber, category: sheet.inventoryCategoryNameSnapshot,
          ingredient: line.ingredientNameSnapshot, ingredientCode: line.ingredientCodeSnapshot,
          quantity, unit, amount, unitPrice: quantity > 0 ? amount / quantity : 0,
          voided: Boolean(transaction.voidedAt), voidReason: transaction.voidReason,
        });
      }
    }
  }

  const purchaseTrend = [];
  const purchaseCursor = new Date(range.dateStart);
  for (let index = 0; index < range.days; index += 1) {
    const key = purchaseCursor.toISOString().slice(0, 10);
    purchaseTrend.push(purchaseTrendMap.get(key) ?? { date: key, amount: 0, lineCount: 0 });
    purchaseCursor.setUTCDate(purchaseCursor.getUTCDate() + 1);
  }

  const operationsByChannel = ["WEBSITE", "ZOMATO", "SWIGGY"].map((channel) => {
    const timing = channelOperations.get(channel) ?? { acceptance: [], preparation: [], handover: [] };
    return {
      channel,
      averageAcceptanceSeconds: average(timing.acceptance), acceptanceCount: timing.acceptance.length,
      averagePreparationSeconds: average(timing.preparation), preparationCount: timing.preparation.length,
      averageReadyToHandoverSeconds: average(timing.handover), handoverCount: timing.handover.length,
    };
  });

  const latestLines = latestStocktake?.lines ?? [];
  let previousStocktake: typeof latestStocktake = null;
  if (latestStocktake) {
    previousStocktake = await prisma.leftoverInventoryTransaction.findFirst({
      where: {
        OR: [
          { stocktakeDate: { lt: latestStocktake.stocktakeDate } },
          { stocktakeDate: latestStocktake.stocktakeDate, createdAt: { lt: latestStocktake.createdAt } },
        ],
      },
      orderBy: [{ stocktakeDate: "desc" }, { createdAt: "desc" }],
      include: { lines: { orderBy: [{ inventoryCategoryNameSnapshot: "asc" }, { sortOrder: "asc" }] } },
    });
  }
  const previousQuantity = new Map((previousStocktake?.lines ?? []).map((line) => [line.ingredientId, money(line.quantity)]));
  const inventorySnapshot = latestLines.map((line) => ({
    category: line.inventoryCategoryNameSnapshot,
    ingredient: line.ingredientNameSnapshot,
    quantity: money(line.quantity),
    unit: line.baseUnitSymbolSnapshot,
    previousQuantity: previousQuantity.has(line.ingredientId) ? previousQuantity.get(line.ingredientId) : null,
    change: previousQuantity.has(line.ingredientId) ? money(line.quantity) - (previousQuantity.get(line.ingredientId) ?? 0) : null,
  }));

  const ncPurposeMap = new Map<string, { label: string; count: number; amount: number }>();
  const ncConsumerMap = new Map<string, { label: string; count: number; amount: number }>();
  const ncItemMap = new Map<string, { label: string; category: string; quantity: number; amount: number }>();
  const validNcEntries = ncEntries.filter((entry) => entry.status !== "VOIDED");
  const ncMenuValue = validNcEntries.reduce((sum, entry) => sum + money(entry.menuValue), 0);
  for (const entry of validNcEntries) {
    addGroup(ncPurposeMap, entry.purpose, entry.purpose.replaceAll("_", " "), money(entry.menuValue));
    addGroup(ncConsumerMap, entry.consumerName.toLowerCase(), entry.consumerName, money(entry.menuValue));
    for (const item of entry.items) {
      const key = item.categoryIdSnapshot + "|" + item.itemNameSnapshot;
      const group = ncItemMap.get(key) ?? {
        label: item.itemNameSnapshot, category: item.categoryNameSnapshot, quantity: 0, amount: 0,
      };
      group.quantity += money(item.scoops);
      group.amount += money(item.lineValue);
      ncItemMap.set(key, group);
    }
  }
  const ncVoidedEntries = ncEntries.filter((entry) => entry.status === "VOIDED");

  const completedOrdersMissingTiming = orders.filter((order) =>
    order.status !== "PENDING" && order.status !== "CANCELLED" &&
    (order.acceptanceDurationSeconds == null || (order.readyAt != null && order.preparationDurationSeconds == null)),
  ).map((order) => ({
    kotNumber: order.kotNumber, invoiceNumber: order.invoiceNumber,
    status: order.status, channel: order.channel, createdAt: order.createdAt,
  }));

  return {
    filters,
    generatedAt: now.toISOString(),
    rowLimits: {
      ordersTruncated: hasMoreOrders,
      purchasesTruncated: hasMorePurchases,
      purchaseLinesTruncated: purchaseLines.length > 5000,
      ncEntriesTruncated: ncEntriesRaw.length > 5000,
    },
    overview: {
      totalOrders: totalOrderCount,
      nonCancelledOrders: exactNonCancelledCount,
      orderValue: exactOrderValue,
      averageOrderValue: exactNonCancelledCount ? exactOrderValue / exactNonCancelledCount : 0,
      cancelledOrders: exactCancelledCount,
      cancelledValue: exactCancelledValue,
      deliveryCharges: exactDeliveryCharges,
      purchaseSpend,
      activePurchaseTransactions: activePurchaseCount,
      voidedPurchaseTransactions: voidedPurchaseCount,
      averageAcceptanceSeconds: orderTimingAggregates._avg.acceptanceDurationSeconds,
      averagePreparationSeconds: orderTimingAggregates._avg.preparationDurationSeconds,
      averageReadyToHandoverSeconds: average(handoverDurations),
    },
    sales: {
      trend, channelMix, areaMix, peakHours: peakHours.slice(0, 8), busiestDays,
      statusCounts, totalOrders: totalOrderCount,
      cancellationByChannel: channelMix.map((item) => ({ channel: item.channel, cancelled: item.cancelled })),
      orders: orders.map((order) => ({
        id: order.id, invoiceNumber: order.invoiceNumber, kotNumber: order.kotNumber,
        channel: order.channel, status: order.status, total: money(order.total),
        deliveryCharge: money(order.deliveryCharge), paymentMethod: order.paymentMethod,
        createdAt: order.createdAt, acceptanceSeconds: order.acceptanceDurationSeconds,
        preparationSeconds: order.preparationDurationSeconds, deliveryArea: order.deliveryArea,
        bowlCount: order.bowls.reduce((sum, bowl) => sum + bowl.quantity, 0),
      })),
    },
    kitchen: {
      acceptanceSla, preparationSla, activeLateOrders,
      operationsByChannel, longestPreparation,
      timingSettings: timingSettings.map((setting) => ({
        channel: setting.channel,
        acceptanceAmberMinutes: setting.acceptanceAmberMinutes,
        acceptanceLateMinutes: setting.acceptanceLateMinutes,
        preparationAmberMinutes: setting.preparationAmberMinutes,
        preparationLateMinutes: setting.preparationLateMinutes,
      })),
    },
    purchases: {
      spend: purchaseSpend, transactionCount: activePurchaseCount, voidedTransactionCount: voidedPurchaseCount,
      trend: purchaseTrend, byCategory: sortedGroups(purchaseCategoryMap), bySupplier: sortedGroups(purchaseSupplierMap),
      byIngredient: [...purchaseIngredientMap.values()].sort((a, b) => b.amount - a.amount),
      lines: purchaseLines.slice(0, 5000),
      voidedTransactions,
    },
    inventory: {
      latestStocktake: latestStocktake ? {
        id: latestStocktake.id, stocktakeDate: latestStocktake.stocktakeDate,
        createdAt: latestStocktake.createdAt, recordedByName: latestStocktake.recordedByName,
        lineCount: latestLines.length,
      } : null,
      previousStocktake: previousStocktake ? {
        stocktakeDate: previousStocktake.stocktakeDate, createdAt: previousStocktake.createdAt,
      } : null,
      snapshot: inventorySnapshot,
      history: stocktakeHistory,
    },
    nc: {
      entryCount: validNcEntries.length,
      menuValue: ncMenuValue,
      queuedCount: validNcEntries.filter((entry) => entry.status === "QUEUED").length,
      preparingCount: validNcEntries.filter((entry) => entry.status === "PREPARING").length,
      readyCount: validNcEntries.filter((entry) => entry.status === "READY").length,
      completedCount: validNcEntries.filter((entry) => entry.status === "COMPLETED").length,
      voidedCount: ncVoidedEntries.length,
      byPurpose: sortedGroups(ncPurposeMap),
      byConsumer: sortedGroups(ncConsumerMap),
      byItem: [...ncItemMap.values()].sort((a, b) => b.amount - a.amount),
      entries: ncEntries.map((entry) => ({
        id: entry.id, reference: entry.reference, businessDate: entry.businessDate,
        purpose: entry.purpose, mode: entry.mode, status: entry.status,
        consumerType: entry.consumerType, consumerName: entry.consumerName,
        recordedByEmail: entry.recordedByEmail, notes: entry.notes,
        menuValue: money(entry.menuValue), createdAt: entry.createdAt,
        completedAt: entry.completedAt, voidedAt: entry.voidedAt,
        voidedByEmail: entry.voidedByEmail, voidReason: entry.voidReason,
        items: entry.items.map((item) => ({
          category: item.categoryNameSnapshot, item: item.itemNameSnapshot,
          scoops: money(item.scoops), unitMenuValue: money(item.unitPriceSnapshot),
          lineValue: money(item.lineValue), selectedOptions: item.selectedOptions,
        })),
      })),
    },
    audit: {
      cancelledOrders: orders.filter((order) => order.status === "CANCELLED").map((order) => ({
        kotNumber: order.kotNumber, invoiceNumber: order.invoiceNumber,
        channel: order.channel, total: money(order.total), cancelledAt: order.cancelledAt,
      })),
      voidedTransactions,
      voidedNcEntries: ncVoidedEntries.map((entry) => ({ reference: entry.reference, consumerName: entry.consumerName, menuValue: money(entry.menuValue), voidedAt: entry.voidedAt, voidedByEmail: entry.voidedByEmail, voidReason: entry.voidReason })),
      activeLateOrders,
      completedOrdersMissingTiming,
    },
  };
}

export async function getReportEmailPreference() {
  return prisma.reportEmailPreference.findUnique({ where: { id: "default" } });
}

export async function saveReportEmailPreference(
  recipientEmail: unknown,
  deliveryTime: unknown,
  selectedReports: unknown,
  updatedByEmail: string,
) {
  if (typeof recipientEmail !== "string" || recipientEmail.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())) {
    throw new ReportError("Enter a valid recipient email address.");
  }
  if (typeof deliveryTime !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(deliveryTime)) {
    throw new ReportError("Delivery time must use 24-hour HH:MM format.");
  }
  if (!Array.isArray(selectedReports) || selectedReports.length < 1 ||
      selectedReports.some((value) => typeof value !== "string" || !REPORT_IDS.includes(value as ReportId)) ||
      new Set(selectedReports).size !== selectedReports.length) {
    throw new ReportError("Select at least one valid report section.");
  }
  return prisma.reportEmailPreference.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      recipientEmail: recipientEmail.trim().toLowerCase(),
      deliveryTime,
      selectedReports: selectedReports as Prisma.InputJsonValue,
      timeZone: "Asia/Kolkata",
      updatedByEmail,
      isEnabled: false,
    },
    update: {
      recipientEmail: recipientEmail.trim().toLowerCase(),
      deliveryTime,
      selectedReports: selectedReports as Prisma.InputJsonValue,
      timeZone: "Asia/Kolkata",
      updatedByEmail,
    },
  });
}

export function defaultReportFilters(): ReportFilters {
  const today = getIndiaBusinessDate();
  return { from: today, to: today, channel: "ALL" };
}
