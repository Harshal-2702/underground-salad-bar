BEGIN;

CREATE TYPE "NCConsumerType" AS ENUM ('STAFF', 'OWNER', 'GUEST', 'VENDOR', 'PARTNER', 'OTHER');
CREATE TYPE "NCPurpose" AS ENUM ('STAFF_MEAL', 'MANAGEMENT', 'GUEST_COMPLIMENTARY', 'VENDOR_PARTNER', 'TASTING_QC', 'TRAINING', 'OTHER');
CREATE TYPE "NCMode" AS ENUM ('PREPARE_NOW', 'ALREADY_CONSUMED');
CREATE TYPE "NCStatus" AS ENUM ('QUEUED', 'PREPARING', 'READY', 'COMPLETED', 'VOIDED');

CREATE TABLE "NCDailySequence" (
  "businessDate" DATE NOT NULL,
  "lastSequence" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NCDailySequence_pkey" PRIMARY KEY ("businessDate")
);

CREATE TABLE "NCConsumptionEntry" (
  "id" TEXT NOT NULL,
  "reference" VARCHAR(40) NOT NULL,
  "businessDate" DATE NOT NULL,
  "sequence" INTEGER NOT NULL,
  "purpose" "NCPurpose" NOT NULL,
  "mode" "NCMode" NOT NULL,
  "status" "NCStatus" NOT NULL DEFAULT 'QUEUED',
  "consumerType" "NCConsumerType" NOT NULL,
  "consumerName" VARCHAR(120) NOT NULL,
  "notes" TEXT,
  "recordedByEmail" VARCHAR(255) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  "voidedByEmail" VARCHAR(255),
  "voidReason" VARCHAR(500),
  "menuValue" DECIMAL(18,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NCConsumptionEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NCConsumptionEntry_reference_key" ON "NCConsumptionEntry"("reference");
CREATE UNIQUE INDEX "NCConsumptionEntry_businessDate_sequence_key" ON "NCConsumptionEntry"("businessDate", "sequence");
CREATE INDEX "NCConsumptionEntry_businessDate_status_idx" ON "NCConsumptionEntry"("businessDate", "status");
CREATE INDEX "NCConsumptionEntry_consumerName_businessDate_idx" ON "NCConsumptionEntry"("consumerName", "businessDate");
CREATE INDEX "NCConsumptionEntry_recordedByEmail_businessDate_idx" ON "NCConsumptionEntry"("recordedByEmail", "businessDate");
CREATE INDEX "NCConsumptionEntry_purpose_businessDate_idx" ON "NCConsumptionEntry"("purpose", "businessDate");

CREATE TABLE "NCConsumptionItem" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "categoryIdSnapshot" VARCHAR(40) NOT NULL,
  "categoryNameSnapshot" VARCHAR(80) NOT NULL,
  "itemNameSnapshot" VARCHAR(120) NOT NULL,
  "scoops" DECIMAL(18,3) NOT NULL,
  "unitPriceSnapshot" DECIMAL(18,2) NOT NULL,
  "lineValue" DECIMAL(18,2) NOT NULL,
  "selectedOptions" JSONB,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NCConsumptionItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NCConsumptionItem_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "NCConsumptionEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "NCConsumptionItem_entryId_sortOrder_idx" ON "NCConsumptionItem"("entryId", "sortOrder");
CREATE INDEX "NCConsumptionItem_itemNameSnapshot_idx" ON "NCConsumptionItem"("itemNameSnapshot");
CREATE INDEX "NCConsumptionItem_categoryIdSnapshot_idx" ON "NCConsumptionItem"("categoryIdSnapshot");

COMMIT;
