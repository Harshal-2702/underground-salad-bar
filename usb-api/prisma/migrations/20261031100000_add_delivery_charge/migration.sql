-- Historical delivery charges cannot be reconstructed reliably.
-- NULL means unknown for orders created before this field existed.
-- New orders store the server-calculated delivery charge explicitly.
ALTER TABLE "Order"
ADD COLUMN "deliveryCharge" DOUBLE PRECISION;
