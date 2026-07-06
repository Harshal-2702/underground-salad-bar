import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import orderRoutes from "./routes/order.routes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/orders", orderRoutes);

app.get("/", (_, res) => {
  res.send("USB API Running 🚀");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});