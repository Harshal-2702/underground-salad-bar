# Order delivery snapshot patch

## Purpose

Each new order now stores the exact delivery name, phone, address, area, and city submitted at checkout. These values belong to the `Order` row and do not depend on the long-lived `Customer` profile, which is still linked by phone for customer history.

Historical orders are intentionally not backfilled. Their original checkout-time delivery details cannot be determined reliably from the current `Customer` record. The kitchen dashboard labels those orders and asks staff to verify before dispatch.

## Files in this patch

- `usb-api/prisma/schema.prisma` — five nullable order snapshot fields.
- `usb-api/prisma/migrations/20261031230000_add_order_delivery_snapshot/migration.sql` — additive migration only; no updates or deletes.
- `usb-api/src/services/order-delivery.ts` — normalized snapshot mapper.
- `usb-api/src/services/order-delivery.test.ts` — unit tests for snapshot capture and repeat-customer address changes.
- `usb-api/src/controllers/order.controller.ts` — persists the snapshot and uses it in Telegram notifications.
- `usb-api/package.json` — runs the pricing and delivery snapshot tests.
- `usb-admin/pages/OrdersPage.tsx` — displays the order snapshot, with an explicit warning for older orders.

## Apply to the working repository

Extract this ZIP into the repository root (`C:\Users\harsh\Downloads\underground-recovery-base`) and allow the files to merge/overwrite. Do not extract it into `usb-api` or `usb-admin` subfolders.

Then, from PowerShell:

```powershell
Set-Location "C:\Users\harsh\Downloads\underground-recovery-base\usb-api"
npm.cmd exec -- prisma generate
npm.cmd test
npm.cmd run build

Set-Location "..\usb-admin"
npm.cmd run build
```

Run the customer website build from the repository root as well:

```powershell
Set-Location "C:\Users\harsh\Downloads\underground-recovery-base"
npm.cmd run build
```

## Database rollout — do not run until approved

1. Take a fresh verified backup of the current database state (after the previously applied delivery-charge migration).
2. Confirm the new migration folder is present under `usb-api/prisma/migrations/`.
3. From `usb-api`, run `npm.cmd exec -- prisma migrate deploy` once.
4. Verify with `npm.cmd exec -- prisma migrate status`.

The migration is additive and keeps all five new fields nullable, so existing order rows remain valid. Do not edit or re-run the already-applied delivery-charge migration.

## Release notes

- No secrets or `.env` files are included.
- No customer profile is overwritten when a repeat customer enters a new delivery address.
- New order API responses include the five snapshot fields.
- Historical rows remain NULL in those fields; kitchen UI falls back to the saved customer profile only as a clearly labelled reference.
