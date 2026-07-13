import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";



export async function createOrder(req: Request, res: Response) {
  try {
    console.log("===== NEW ORDER =====");
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

console.log("REQUEST BODY:");
console.log(JSON.stringify(req.body, null, 2));

    if (!customerName || !phone || !address || !area || !city) {
      return res.status(400).json({
        error: "Missing customer details",
      });
    }

    if (!Array.isArray(bowls) || bowls.length === 0) {
      return res.status(400).json({
        error: "No bowls received",
      });
    }

    const invoiceNumber = `USB-${Date.now()}`;

    

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
    const id = req.params.id as string;

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
