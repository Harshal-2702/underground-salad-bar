import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";



export async function createOrder(
  req: Request,
  res: Response
) {
  try {
    const {
      customerName,
      phone,
      address,
      area,
      city,
      items,
      total,
    } = req.body;
const invoiceNumber = `USB-${Date.now()}`;
const { bowls } = req.body;
    const order = await prisma.order.create({
  data: {
    invoiceNumber,
    total,
    paymentMethod: "COD",
    status: "PENDING",

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
      })),
    },
  },

  include: {
    customer: true,
    bowls: true,
  },
});
    res.json(order);
  } 
catch (err: any) {
  console.error("CREATE ORDER ERROR:", err);

  res.status(500).json({
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
