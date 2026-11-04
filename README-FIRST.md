# USB Secure Pricing — migration correction v1.1

This is a focused correction to the already-applied local pricing patch. Extract this ZIP into the recovered project root:

`C:\Users\harsh\Downloads\underground-recovery-base`

It replaces only:
- `usb-api/prisma/schema.prisma`
- `usb-api/prisma/migrations/20261031100000_add_delivery_charge/migration.sql`

## Why this correction exists

The previous draft used `DEFAULT 0` for historical orders. That would conflate unknown historical delivery fees with genuinely free delivery. This version makes `Order.deliveryCharge` nullable and adds the column without a default. Existing orders therefore receive NULL; new orders save the calculated amount explicitly. Existing `Order.total` values are not updated.

## Verify locally (no database mutation)

From `usb-api`:

```powershell
npm.cmd exec -- prisma validate
npm.cmd exec -- prisma generate
npm.cmd run build
npm.cmd test
npm.cmd exec -- prisma migrate status
```

`prisma migrate status` should still report `20261031100000_add_delivery_charge` as pending. Do not run `prisma migrate deploy` until a fresh backup is verified and the production release sequence is approved.
