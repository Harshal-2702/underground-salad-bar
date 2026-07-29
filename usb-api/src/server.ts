import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { supabase } from "./services/supabase.js";
import { prisma } from "./lib/prisma.js";
import orderRoutes from "./routes/order.routes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());


app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "Underground Salad Bar API",
    time: new Date(),
  });
});

app.get("/ping-db", async (_, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      success: true,
      message: "Database Awake",
      time: new Date(),
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
    });
  }
});

app.get("/test-supabase", async (_, res) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .insert([
        {
          customer_name: "Harshal Test",
          phone: "9999999999",
          total: 250,
          status: "pending",
        },
      ])
      .select();

    if (error) {
      console.error(error);

      return res.status(500).json(error);
    }

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json(err);
  }
});

app.use("/orders", orderRoutes);

app.get("/", (_, res) => {
  res.send("USB API Running 🚀");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});