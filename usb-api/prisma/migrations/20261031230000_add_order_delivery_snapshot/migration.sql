-- Preserve the exact delivery details submitted for each order.
-- Historical orders remain NULL because their original checkout address
-- cannot be reconstructed reliably from the current Customer profile.
ALTER TABLE "Order"
  ADD COLUMN "deliveryName" TEXT,
  ADD COLUMN "deliveryPhone" TEXT,
  ADD COLUMN "deliveryAddress" TEXT,
  ADD COLUMN "deliveryArea" TEXT,
  ADD COLUMN "deliveryCity" TEXT;
