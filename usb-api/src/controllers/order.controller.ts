import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { sendTelegramMessage } from "../services/telegram.service.js";

console.log("🔥 ORDER CONTROLLER FILE LOADED");

export async function createOrder(req: Request, res: Response) {
  console.log("STEP 1 - createOrder called");

  try {
    console.log("STEP 2 - Request received");
    console.log(JSON.stringify(req.body, null, 2));

    const {
      customerName,
      phone,
      address,
      area,
      city,
      total,
      bowls,
    } = req.body;

    console.log("STEP 3 - Body parsed");

    if (!customerName || !phone || !address || !area || !city) {
      console.log("❌ Missing customer details");

      return res.status(400).json({
        error: "Missing customer details",
      });
    }

    if (!Array.isArray(bowls) || bowls.length === 0) {
      console.log("❌ No bowls received");

      return res.status(400).json({
        error: "No bowls received",
      });
    }

    console.log("STEP 4 - Validation passed");

    const invoiceNumber = `USB-${Date.now()}`;

    console.log("STEP 5 - Creating Prisma Order");

    const order = await prisma.order.create({
      data: {
        invoiceNumber,
        total: Number(total),
        paymentMethod: "COD",

        customer: {
          connectOrCreate: {
            where: {
              phone,
            },
            create: {
              name: customerName,
              phone,
              address,
              area,
              city,
            },
          },
        },

        bowls: {
          create: bowls.map((b: any) => ({
            bowlName: b.name,
            quantity: b.quantity,
            price: b.price,
            details: b.details,
          })),
        },
      },

      include: {
        customer: true,
        bowls: true,
      },
    });

    console.log("✅ STEP 6 - Order saved");
    console.log(order);

    const message = `
🥗 <b>NEW ORDER RECEIVED</b>

🧾 <b>Invoice:</b> ${order.invoiceNumber}

👤 <b>Customer:</b> ${order.customer.name}

📞 <b>Phone:</b> ${order.customer.phone}

📍 <b>Area:</b> ${order.customer.area}

🏠 <b>Address:</b>
${order.customer.address}

💰 <b>Total:</b> ₹${order.total}

━━━━━━━━━━━━━━━━━━

${order.bowls
  .map(
    (b, index) => `
🍽 <b>Bowl ${index + 1}</b>

${b.details ?? "No details"}
`
  )
  .join("\n")}
`;

    console.log("STEP 7 - Telegram message created");

    try {
      console.log("📨 Sending Telegram...");

      await sendTelegramMessage(message);

      console.log("✅ Telegram Sent");
    } catch (telegramError) {
      console.error("❌ Telegram Failed");
      console.error(telegramError);

      // Don't stop the order if Telegram fails
    }

    console.log("STEP 8 - Returning response");

    return res.json(order);
  } catch (err: any) {
    console.error("========== CREATE ORDER ERROR ==========");
    console.error(err);
    console.error(err?.message);
    console.error(err?.stack);
    console.error("========================================");

    return res.status(500).json({
      message: err?.message,
      code: err?.code,
      meta: err?.meta,
    });
  }
}

export async function getOrders(
  req: Request,
  res: Response
) {
  const orders = await prisma.order.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      customer: true,
      bowls: true,
    },
  });

  res.json(orders);
}

export async function updateOrderStatus(
  req: Request,
  res: Response
) {
  try {
    const { id } = req.params as { id: string };

    const { status } = req.body;

    const order = await prisma.order.update({
      where: {
        id,
      },
      data: {
        status,
      },
    });

    res.json(order);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Unable to update order",
    });
  }
}