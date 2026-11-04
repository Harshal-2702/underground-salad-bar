import type { Request, Response } from "express";
import { OrderStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { calculateOrderPricing, PricingValidationError } from "../services/pricing.js";
import { sendTelegramMessage } from "../services/telegram.service.js";
import { createOrderDeliverySnapshot } from "../services/order-delivery.js";

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
    const deliverySnapshot = createOrderDeliverySnapshot({
      customerName,
      phone,
      address,
      area,
    });
    const canonicalArea = deliverySnapshot.deliveryArea;
    const canonicalCity = deliverySnapshot.deliveryCity;
    const invoiceNumber = `USB-${Date.now()}`;

    const order = await prisma.order.create({
      data: {
        invoiceNumber,
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
              area: canonicalArea,
              city: canonicalCity,
            },
          },
        },
        bowls: {
          create: pricing.bowls,
        },
      },
      include: {
        customer: true,
        bowls: true,
      },
    });

    const message = `
🥗 <b>NEW ORDER RECEIVED</b>

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

export async function getOrders(_req: Request, res: Response) {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { customer: true, bowls: true },
  });

  res.json(orders);
}

export async function updateOrderStatus(req: Request, res: Response) {
  try {
    const { id } = req.params as { id: string };
    const { status } = req.body ?? {};

    if (!isOrderStatus(status)) {
      return res.status(400).json({ error: "Invalid order status." });
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status },
    });

    return res.json(order);
  } catch (error) {
    console.error("Order status update failed", {
      name: (error as any)?.name,
      code: (error as any)?.code,
    });

    return res.status(500).json({ error: "Unable to update order. Please try again." });
  }
}
