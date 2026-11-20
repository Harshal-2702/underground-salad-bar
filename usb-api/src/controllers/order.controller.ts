import type { Request, Response } from "express";
import { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { calculateOrderPricing, PricingValidationError } from "../services/pricing.js";
import { sendTelegramMessage } from "../services/telegram.service.js";
import { createOrderDeliverySnapshot } from "../services/order-delivery.js";
import {
  allocateKotIdentity,
  canTransitionOrderStatus,
  getIndiaBusinessDate,
  getIndiaDateRange,
  getKitchenOrderStatusWhere,
  isDateKey,
  KotValidationError,
  buildOrderTimingUpdate,
} from "../services/kot.service.js";

function isOrderStatus(value: unknown): value is OrderStatus {
  return Object.values(OrderStatus).includes(value as OrderStatus);
}

function isText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

function escapeHtml(value: string): string {
  const replacements: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (character) => replacements[character]);
}

export async function createOrder(req: Request, res: Response) {
  try {
    const body = req.body ?? {};
    const { customerName, phone, address, area, city, bowls } = body;

    if (!isText(customerName, 100) || !isText(phone, 10) || !/^[6-9]\d{9}$/.test(phone.trim()) ||
        !isText(address, 500) || !isText(area, 80) || !isText(city, 40) || city.trim().toLowerCase() !== "pune") {
      return res.status(400).json({ error: "Please provide valid customer and delivery details." });
    }

    // All ingredient prices, bowl totals, delivery charges and final totals are
    // recalculated from the server-owned catalogue. Client prices/totals are ignored.
    const pricing = calculateOrderPricing(bowls, area.trim());
    const deliverySnapshot = createOrderDeliverySnapshot({ customerName, phone, address, area });
    const businessDate = getIndiaBusinessDate();
    const invoiceNumber = `USB-${Date.now()}`;

    // KOT allocation and order creation share one transaction. A failed checkout
    // therefore cannot consume a daily KOT number or create a partial order.
    const order = await prisma.$transaction(async (tx) => {
      const kotIdentity = await allocateKotIdentity(tx, businessDate);
      return tx.order.create({
        data: {
          invoiceNumber,
          channel: "WEBSITE",
          ...kotIdentity,
          ...deliverySnapshot,
          total: pricing.total,
          deliveryCharge: pricing.deliveryCharge,
          paymentMethod: "COD",
          customer: {
            connectOrCreate: {
              where: { phone: phone.trim() },
              create: {
                name: customerName.trim(),
                phone: phone.trim(),
                address: address.trim(),
                area: deliverySnapshot.deliveryArea,
                city: deliverySnapshot.deliveryCity,
              },
            },
          },
          bowls: { create: pricing.bowls },
          statusEvents: { create: { toStatus: OrderStatus.PENDING } },
        },
        include: { customer: true, bowls: true },
      });
    });

    const message = `
🥗 <b>NEW ORDER RECEIVED</b>

🧾 <b>KOT:</b> ${escapeHtml(order.kotNumber)}
🧾 <b>Invoice:</b> ${escapeHtml(order.invoiceNumber)}

👤 <b>Customer:</b> ${escapeHtml(deliverySnapshot.deliveryName)}
📞 <b>Phone:</b> ${escapeHtml(deliverySnapshot.deliveryPhone)}
📍 <b>Area:</b> ${escapeHtml(deliverySnapshot.deliveryArea)}
🏠 <b>Address:</b>
${escapeHtml(deliverySnapshot.deliveryAddress)}

🧺 <b>Items subtotal:</b> ₹${pricing.itemsSubtotal}
🚚 <b>Delivery:</b> ₹${order.deliveryCharge}
💰 <b>Total payable:</b> ₹${order.total}

━━━━━━━━━━━━━━━━━━

${order.bowls
  .map((bowl, index) => `🍽 <b>Bowl ${index + 1} — ₹${bowl.price}</b>\n${escapeHtml(bowl.details ?? "No details")}`)
  .join("\n\n")}
`;

    try {
      await sendTelegramMessage(message);
    } catch {
      // The order is already saved; notification failure must not undo it.
      console.error("Telegram notification failed; the order remains saved.");
    }

    return res.status(201).json(order);
  } catch (error) {
    if (error instanceof PricingValidationError) {
      return res.status(400).json({ error: error.message });
    }

    console.error("Order creation failed", {
      name: (error as any)?.name,
      code: (error as any)?.code,
    });

    return res.status(500).json({ message: "Unable to place your order. Please try again." });
  }
}

function parsePositiveInteger(value: unknown, fallback: number, max: number): number | null {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > max) return null;
  return number;
}

export async function getOrders(req: Request, res: Response) {
  try {
    const dateValue = typeof req.query.date === "string" ? req.query.date : getIndiaBusinessDate();
    if (!isDateKey(dateValue)) {
      return res.status(400).json({ error: "Date must use YYYY-MM-DD format." });
    }

    const channelValue = typeof req.query.channel === "string" ? req.query.channel : "ALL";
    const allowedChannels = ["ALL", "WEBSITE", "ZOMATO", "SWIGGY"];
    if (!allowedChannels.includes(channelValue)) {
      return res.status(400).json({ error: "Invalid order channel filter." });
    }

    const statusValue = typeof req.query.status === "string" ? req.query.status : "ALL";
    const statusWhere = getKitchenOrderStatusWhere(statusValue);
    if (!statusWhere) {
      return res.status(400).json({ error: "Invalid kitchen order status filter." });
    }

    const page = parsePositiveInteger(req.query.page, 1, 1_000_000);
    const pageSize = parsePositiveInteger(req.query.pageSize, 50, 100);
    if (!page || !pageSize) {
      return res.status(400).json({ error: "Invalid pagination values." });
    }

    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
    const { start, end } = getIndiaDateRange(dateValue);

    const dateWhere: Prisma.OrderWhereInput = { createdAt: { gte: start, lt: end } };
    const channelWhere: Prisma.OrderWhereInput = {
      ...dateWhere,
      ...(channelValue !== "ALL" ? { channel: channelValue as "WEBSITE" | "ZOMATO" | "SWIGGY" } : {}),
    };
    const searchFilters: Prisma.OrderWhereInput[] = search ? [
      { kotNumber: { contains: search, mode: "insensitive" } },
      { invoiceNumber: { contains: search, mode: "insensitive" } },
      { externalOrderId: { contains: search, mode: "insensitive" } },
      { deliveryName: { contains: search, mode: "insensitive" } },
      { deliveryPhone: { contains: search } },
      { customer: { is: { name: { contains: search, mode: "insensitive" } } } },
      { customer: { is: { phone: { contains: search } } } },
    ] : [];
    const where: Prisma.OrderWhereInput = {
      ...channelWhere,
      ...statusWhere,
      ...(search ? { OR: searchFilters } : {}),
    };

    const [items, total, statusGroups, channelGroups] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { kotSequence: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          customer: true,
          bowls: true,
          statusEvents: { orderBy: { createdAt: "asc" } },
        },
      }),
      prisma.order.count({ where }),
      prisma.order.groupBy({ by: ["status"], where: channelWhere, _count: { _all: true } }),
      prisma.order.groupBy({ by: ["channel"], where: dateWhere, _count: { _all: true } }),
    ]);

    const statusCounts = Object.fromEntries(
      Object.values(OrderStatus).map((status) => [status, 0]),
    ) as Record<OrderStatus, number>;
    for (const group of statusGroups) statusCounts[group.status] = group._count._all;

    const channelCounts = { WEBSITE: 0, ZOMATO: 0, SWIGGY: 0 };
    for (const group of channelGroups) channelCounts[group.channel] = group._count._all;

    return res.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      selectedDate: dateValue,
      statusCounts,
      channelCounts,
    });
  } catch (error) {
    if (error instanceof KotValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Order list failed", { name: (error as any)?.name, code: (error as any)?.code });
    return res.status(500).json({ error: "Unable to load kitchen orders." });
  }
}

export async function updateOrderStatus(req: Request, res: Response) {
  try {
    const { id } = req.params as { id: string };
    const { status } = req.body ?? {};

    if (!isOrderStatus(status)) {
      return res.status(400).json({ error: "Invalid order status." });
    }

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.order.findUnique({
        where: { id },
        select: { status: true, createdAt: true, acceptedAt: true },
      });
      if (!current) return { kind: "NOT_FOUND" as const };
      if (current.status === status) {
        return {
          kind: "UNCHANGED" as const,
          order: await tx.order.findUnique({
            where: { id },
            include: { customer: true, bowls: true, statusEvents: { orderBy: { createdAt: "asc" } } },
          }),
        };
      }
      if (!canTransitionOrderStatus(current.status, status)) {
        return { kind: "INVALID_TRANSITION" as const, currentStatus: current.status };
      }

      const changedAt = new Date();
      const timingUpdate = buildOrderTimingUpdate(
        { status: current.status, createdAt: current.createdAt, acceptedAt: current.acceptedAt },
        status,
        changedAt,
      );
      const changed = await tx.order.updateMany({
        where: { id, status: current.status },
        data: { status, ...timingUpdate },
      });
      if (changed.count !== 1) return { kind: "CONFLICT" as const };

      const actorEmail = typeof res.locals.adminEmail === "string" ? res.locals.adminEmail : null;
      await tx.orderStatusEvent.create({
        data: { orderId: id, fromStatus: current.status, toStatus: status, actorEmail, createdAt: changedAt },
      });
      const order = await tx.order.findUnique({
        where: { id },
        include: { customer: true, bowls: true, statusEvents: { orderBy: { createdAt: "asc" } } },
      });
      return { kind: "UPDATED" as const, order };
    });

    if (result.kind === "NOT_FOUND") return res.status(404).json({ error: "Order not found." });
    if (result.kind === "INVALID_TRANSITION") {
      return res.status(409).json({ error: `Order cannot move from ${result.currentStatus} to ${status}.` });
    }
    if (result.kind === "CONFLICT") {
      return res.status(409).json({ error: "Order changed while you were updating it. Refresh and try again." });
    }
    return res.json(result.order);
  } catch (error) {
    console.error("Order status update failed", { name: (error as any)?.name, code: (error as any)?.code });
    return res.status(500).json({ error: "Unable to update order. Please try again." });
  }
}
