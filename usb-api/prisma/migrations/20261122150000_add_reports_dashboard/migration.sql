BEGIN;

CREATE TABLE "ReportEmailPreference" (
  "id" VARCHAR(40) NOT NULL DEFAULT 'default',
  "recipientEmail" VARCHAR(255) NOT NULL,
  "deliveryTime" VARCHAR(5) NOT NULL,
  "selectedReports" JSONB NOT NULL,
  "timeZone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
  "isEnabled" BOOLEAN NOT NULL DEFAULT false,
  "updatedByEmail" VARCHAR(255),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReportEmailPreference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReportEmailPreference_deliveryTime_check" CHECK ("deliveryTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);

CREATE INDEX "ReportEmailPreference_isEnabled_deliveryTime_idx"
  ON "ReportEmailPreference"("isEnabled", "deliveryTime");

COMMIT;
