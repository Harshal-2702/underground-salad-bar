import express from "express";
import cors from "cors";
import orderRoutes from "./routes/order.routes.js";

const app = express();


app.use(express.json());

app.use("/orders", orderRoutes);

app.use(cors());

app.use(express.json());

app.get("/", (req, res) => {
  res.send("USB Backend Running 🚀");
});

export default app;