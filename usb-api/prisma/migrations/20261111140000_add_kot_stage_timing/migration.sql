-- KOT stage timers and per-channel acceptance/preparation SLA thresholds.
-- Existing timestamps are backfilled only from recorded OrderStatusEvent rows.

ALTER TABLE "Order"
  ADD COLUMN "acceptedAt" TIMESTAMP(3),
  ADD COLUMN "readyAt" TIMESTAMP(3),
  ADD COLUMN "handedOverAt" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "acceptanceDurationSeconds" INTEGER,
  ADD COLUMN "preparationDurationSeconds" INTEGER;

WITH event_times AS (
  SELECT
    "orderId",
    MIN("createdAt") FILTER (WHERE "toStatus" IN ('CONFIRMED', 'PREPARING')) AS accepted_at,
    MIN("createdAt") FILTER (WHERE "toStatus" = 'READY') AS ready_at,
    MIN("createdAt") FILTER (WHERE "toStatus" IN ('OUT_FOR_DELIVERY', 'DELIVERED')) AS handed_over_at,
    MIN("createdAt") FILTER (WHERE "toStatus" = 'CANCELLED') AS cancelled_at
  FROM "OrderStatusEvent"
  GROUP BY "orderId"
)
UPDATE "Order" AS o
SET
  "acceptedAt" = e.accepted_at,
  "readyAt" = e.ready_at,
  "handedOverAt" = e.handed_over_at,
  "cancelledAt" = e.cancelled_at,
  "acceptanceDurationSeconds" = CASE
    WHEN e.accepted_at IS NOT NULL
      THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (e.accepted_at - o."createdAt")))::integer)
    ELSE NULL
  END,
  "preparationDurationSeconds" = CASE
    WHEN e.accepted_at IS NOT NULL AND COALESCE(e.ready_at, e.cancelled_at) IS NOT NULL
      THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (COALESCE(e.ready_at, e.cancelled_at) - e.accepted_at)))::integer)
    ELSE NULL
  END
FROM event_times AS e
WHERE o."id" = e."orderId";

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_acceptanceDurationSeconds_nonnegative_check"
    CHECK ("acceptanceDurationSeconds" IS NULL OR "acceptanceDurationSeconds" >= 0),
  ADD CONSTRAINT "Order_preparationDurationSeconds_nonnegative_check"
    CHECK ("preparationDurationSeconds" IS NULL OR "preparationDurationSeconds" >= 0);

CREATE TABLE "KotChannelTimingSetting" (
  "channel" "OrderChannel" NOT NULL,
  "acceptanceAmberMinutes" INTEGER,
  "acceptanceLateMinutes" INTEGER,
  "preparationAmberMinutes" INTEGER,
  "preparationLateMinutes" INTEGER,
  "updatedByEmail" VARCHAR(255),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KotChannelTimingSetting_pkey" PRIMARY KEY ("channel"),
  CONSTRAINT "KotChannelTimingSetting_acceptance_pair_check" CHECK (
    ("acceptanceAmberMinutes" IS NULL AND "acceptanceLateMinutes" IS NULL)
    OR (
      "acceptanceAmberMinutes" IS NOT NULL
      AND "acceptanceLateMinutes" IS NOT NULL
      AND "acceptanceAmberMinutes" BETWEEN 1 AND 1440
      AND "acceptanceLateMinutes" BETWEEN 1 AND 1440
      AND "acceptanceLateMinutes" > "acceptanceAmberMinutes"
    )
  ),
  CONSTRAINT "KotChannelTimingSetting_preparation_pair_check" CHECK (
    ("preparationAmberMinutes" IS NULL AND "preparationLateMinutes" IS NULL)
    OR (
      "preparationAmberMinutes" IS NOT NULL
      AND "preparationLateMinutes" IS NOT NULL
      AND "preparationAmberMinutes" BETWEEN 1 AND 1440
      AND "preparationLateMinutes" BETWEEN 1 AND 1440
      AND "preparationLateMinutes" > "preparationAmberMinutes"
    )
  )
);

-- Create disabled (unconfigured) rows so every channel appears in the Owner settings UI.
INSERT INTO "KotChannelTimingSetting" ("channel", "updatedAt")
VALUES
  ('WEBSITE', CURRENT_TIMESTAMP),
  ('ZOMATO', CURRENT_TIMESTAMP),
  ('SWIGGY', CURRENT_TIMESTAMP)
ON CONFLICT ("channel") DO NOTHING;
