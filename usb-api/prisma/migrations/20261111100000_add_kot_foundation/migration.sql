-- KOT-01: additive kitchen order foundation.
-- Existing orders are retained and backfilled into the WEBSITE channel.

CREATE TYPE "OrderChannel" AS ENUM ('WEBSITE', 'ZOMATO', 'SWIGGY');

ALTER TABLE "Order"
  ADD COLUMN "channel" "OrderChannel" NOT NULL DEFAULT 'WEBSITE',
  ADD COLUMN "externalOrderId" VARCHAR(120),
  ADD COLUMN "kotNumber" VARCHAR(40),
  ADD COLUMN "kotBusinessDate" DATE,
  ADD COLUMN "kotSequence" INTEGER,
  ADD COLUMN "specialInstructions" TEXT;

-- Allocate historical KOTs by India business date and original creation order.
WITH numbered AS (
  SELECT
    "id",
    ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date AS business_date,
    ROW_NUMBER() OVER (
      PARTITION BY ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date
      ORDER BY "createdAt" ASC, "id" ASC
    )::integer AS sequence_number
  FROM "Order"
)
UPDATE "Order" AS o
SET
  "kotBusinessDate" = n.business_date,
  "kotSequence" = n.sequence_number,
  "kotNumber" = 'KOT-' || TO_CHAR(n.business_date, 'YYYYMMDD') || '-' || LPAD(n.sequence_number::text, GREATEST(3, LENGTH(n.sequence_number::text)), '0')
FROM numbered AS n
WHERE o."id" = n."id";

ALTER TABLE "Order"
  ALTER COLUMN "kotBusinessDate" SET NOT NULL,
  ALTER COLUMN "kotSequence" SET NOT NULL,
  ALTER COLUMN "kotNumber" SET NOT NULL,
  ALTER COLUMN "customerId" DROP NOT NULL;

-- Aggregator orders may not have a customer profile in the Underground customer table.
ALTER TABLE "Order" DROP CONSTRAINT "Order_customerId_fkey";
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Order_kotNumber_key" ON "Order"("kotNumber");
CREATE UNIQUE INDEX "Order_kotBusinessDate_kotSequence_key" ON "Order"("kotBusinessDate", "kotSequence");
CREATE UNIQUE INDEX "Order_channel_externalOrderId_key" ON "Order"("channel", "externalOrderId");
CREATE INDEX "Order_createdAt_channel_idx" ON "Order"("createdAt", "channel");
CREATE INDEX "Order_kotBusinessDate_status_idx" ON "Order"("kotBusinessDate", "status");

CREATE TABLE "KotDailySequence" (
  "businessDate" DATE NOT NULL,
  "lastSequence" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KotDailySequence_pkey" PRIMARY KEY ("businessDate")
);

INSERT INTO "KotDailySequence" ("businessDate", "lastSequence")
SELECT "kotBusinessDate", MAX("kotSequence")
FROM "Order"
GROUP BY "kotBusinessDate";

CREATE TABLE "OrderStatusEvent" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "fromStatus" "OrderStatus",
  "toStatus" "OrderStatus" NOT NULL,
  "actorEmail" VARCHAR(255),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderStatusEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OrderStatusEvent"
  ADD CONSTRAINT "OrderStatusEvent_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "OrderStatusEvent_orderId_createdAt_idx"
  ON "OrderStatusEvent"("orderId", "createdAt");

-- Historical orders retain their current status but have no fabricated status timeline.
-- New status events are recorded from the point KOT-01 is deployed.

CREATE TABLE "KotTemplate" (
  "id" TEXT NOT NULL,
  "code" VARCHAR(40) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KotTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KotTemplateVersion" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "config" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdByEmail" VARCHAR(255),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KotTemplateVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KotTemplate_code_key" ON "KotTemplate"("code");
CREATE UNIQUE INDEX "KotTemplateVersion_templateId_versionNumber_key"
  ON "KotTemplateVersion"("templateId", "versionNumber");
CREATE INDEX "KotTemplateVersion_templateId_isActive_idx"
  ON "KotTemplateVersion"("templateId", "isActive");
CREATE UNIQUE INDEX "KotTemplateVersion_one_active_per_template_key"
  ON "KotTemplateVersion"("templateId") WHERE "isActive" = true;

ALTER TABLE "KotTemplateVersion"
  ADD CONSTRAINT "KotTemplateVersion_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "KotTemplate"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
