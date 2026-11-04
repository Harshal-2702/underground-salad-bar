
import "dotenv/config";
import express from "express";
import cors from "cors";
import orderRoutes from "./routes/order.routes.js";

const app = express();

// Load the exact browser origins allowed to communicate with this API.
const allowedOrigins = new Set(
  (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

if (allowedOrigins.size === 0) {
  throw new Error(
    "CORS_ALLOWED_ORIGINS is missing or empty. Configure trusted origins."
  );
}

// CORS controls browser access. It does NOT replace API authentication.
app.use(
  cors({
    origin(origin, callback) {
      // Requests without Origin (curl and server-to-server requests)
      // are not browser CORS requests. Staff routes remain authenticated.
      if (!origin) {
        return callback(null, false);
      }

      callback(null, allowedOrigins.has(origin));
    },
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  })
);

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "Underground Salad Bar API",
    time: new Date(),
  });
});

// Public customer checkout; staff order endpoints require authentication.
app.use("/orders", orderRoutes);

app.get("/", (_req, res) => {
  res.send("USB API Running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
