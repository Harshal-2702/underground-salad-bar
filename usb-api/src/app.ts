import express from "express";
import cors from "cors";
import orderRoutes from "./routes/order.routes.js";

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

app.use(express.json());

app.use("/orders", orderRoutes);



app.get("/", (req, res) => {
  res.send("USB Backend Running 🚀");
});

export default app;