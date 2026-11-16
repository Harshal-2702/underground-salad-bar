import "dotenv/config";
import express from "express";
import cors from "cors";
import orderRoutes from "./routes/order.routes.js";
import {
  ingredientRouter,
  unitRouter,
  categoryRouter,
  allergenRouter,
} from "./routes/ingredient-catalogue.routes.js";
import { recipeRouter } from "./routes/recipe.routes.js";
import kotRoutes from "./routes/kot.routes.js";
import { inventoryCategoryRouter } from "./routes/inventory-category.routes.js";
import { purchaseRouter } from "./routes/purchase.routes.js";

const app = express();

// Keep manually configured origins for stable customer and local environments.
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

// Vercel creates a new deployment-specific hostname for each Preview build.
// Allow only HTTPS deployments belonging to this exact Admin project and team.
// Do not use a broad *.vercel.app rule.
function isTrustedAdminPreviewOrigin(origin: string): boolean {
  let parsedOrigin: URL;

  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  return (
    parsedOrigin.protocol === "https:" &&
    parsedOrigin.origin === origin &&
    /^underground-salad-bar-5213-[a-z0-9-]+-harshals-projects-d6c7ef90\.vercel\.app$/i.test(
      parsedOrigin.hostname
    )
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

      const allowed =
        allowedOrigins.has(origin) || isTrustedAdminPreviewOrigin(origin);

      callback(null, allowed);
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
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

// Staff-only ingredient catalogue APIs.
app.use("/ingredients", ingredientRouter);
app.use("/units", unitRouter);
app.use("/ingredient-categories", categoryRouter);
app.use("/allergens", allergenRouter);
app.use("/inventory-categories", inventoryCategoryRouter);
app.use("/purchases", purchaseRouter);
app.use("/recipes", recipeRouter);
app.use("/kot", kotRoutes);

app.get("/", (_req, res) => {
  res.send("USB API Running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
