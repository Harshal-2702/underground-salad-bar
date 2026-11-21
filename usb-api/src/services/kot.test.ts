import test from "node:test";
import assert from "node:assert/strict";
import { OrderStatus } from "@prisma/client";
import {
  DEFAULT_KOT_TEMPLATE,\n  DEFAULT_CUSTOMER_KOT_TEMPLATE,
  getIndiaBusinessDate,
  getIndiaDateRange,
  isDateKey,
  validateKotTemplateConfig,
  canTransitionOrderStatus,
  getKitchenOrderStatusWhere,
  KotValidationError,
  validateKotChannelTimingSettings,
  getKotTimerSeverity,
  buildOrderTimingUpdate,
} from "./kot.service.js";

test("KOT business date uses Asia/Kolkata rather than server timezone", () => {
  assert.equal(getIndiaBusinessDate(new Date("2026-11-10T20:00:00.000Z")), "2026-11-11");
  assert.equal(getIndiaBusinessDate(new Date("2026-11-11T17:59:59.999Z")), "2026-11-11");
  assert.equal(getIndiaBusinessDate(new Date("2026-11-11T18:30:00.000Z")), "2026-11-12");
});

test("India date range maps midnight IST to UTC boundaries", () => {
  const range = getIndiaDateRange("2026-11-11");
  assert.equal(range.start.toISOString(), "2026-11-10T18:30:00.000Z");
  assert.equal(range.end.toISOString(), "2026-11-11T18:30:00.000Z");
});

test("date keys reject invalid calendar dates", () => {
  assert.equal(isDateKey("2026-11-11"), true);
  assert.equal(isDateKey("2026-02-30"), false);
  assert.equal(isDateKey("11-11-2026"), false);
});

test("KOT template validation enforces required ticket content", () => {
  const config = validateKotTemplateConfig({
    ...DEFAULT_KOT_TEMPLATE,
    showKotNumber: false,
    showChannel: false,
    showReceivedAt: false,
    showItems: false,
    showSpecialInstructions: false,
  });
  assert.equal(config.showKotNumber, true);
  assert.equal(config.showChannel, true);
  assert.equal(config.showReceivedAt, true);
  assert.equal(config.showItems, true);
  assert.equal(config.showSpecialInstructions, true);
});

test("customer and kitchen copies validate independently with different privacy rules", () => {
  const customer = validateKotTemplateConfig({ ...DEFAULT_CUSTOMER_KOT_TEMPLATE }, "CUSTOMER");
  assert.equal(customer.showItemPrices, true);
  assert.equal(customer.showSubtotal, true);
  assert.equal(customer.showDeliveryCharge, true);
  assert.equal(customer.showTotal, true);
  assert.equal(customer.showPaymentMethod, true);

  const kitchen = validateKotTemplateConfig({
    ...DEFAULT_KOT_TEMPLATE,
    showCustomerPhone: true,
    showDeliveryAddress: true,
    showItemPrices: true,
    showSubtotal: true,
    showDeliveryCharge: true,
    showPaymentMethod: true,
  }, "KITCHEN");
  assert.equal(kitchen.showCustomerPhone, false);
  assert.equal(kitchen.showDeliveryAddress, false);
  assert.equal(kitchen.showItemPrices, false);
  assert.equal(kitchen.showSubtotal, false);
  assert.equal(kitchen.showDeliveryCharge, false);
  assert.equal(kitchen.showPaymentMethod, false);
  assert.equal(kitchen.showTotal, false);
});

test("customer copy cannot hide amount payable and each section must appear once", () => {
  assert.throws(
    () => validateKotTemplateConfig({ ...DEFAULT_CUSTOMER_KOT_TEMPLATE, showTotal: false }, "CUSTOMER"),
    KotValidationError,
  );
  assert.throws(
    () => validateKotTemplateConfig({
      ...DEFAULT_KOT_TEMPLATE,
      sectionOrder: ["order", "customer", "items", "totals", "special", "special"],
    }),
    KotValidationError,
  );
});

test("KOT template validation rejects unsafe printer values", () => {
  assert.throws(
    () => validateKotTemplateConfig({ ...DEFAULT_KOT_TEMPLATE, paperWidth: "100mm" }),
    KotValidationError,
  );
  assert.throws(
    () => validateKotTemplateConfig({ ...DEFAULT_KOT_TEMPLATE, fontSize: 30 }),
    KotValidationError,
  );
  assert.throws(
    () => validateKotTemplateConfig({ ...DEFAULT_KOT_TEMPLATE, margin: "extra-wide" }),
    KotValidationError,
  );
});

test("kitchen workflow uses NEW, ACCEPTED, READY and handed-over outcomes", () => {
  assert.equal(canTransitionOrderStatus(OrderStatus.PENDING, OrderStatus.CONFIRMED), true);
  assert.equal(canTransitionOrderStatus(OrderStatus.CONFIRMED, OrderStatus.READY), true);
  assert.equal(canTransitionOrderStatus(OrderStatus.CONFIRMED, OrderStatus.PREPARING), false);
  assert.equal(canTransitionOrderStatus(OrderStatus.PREPARING, OrderStatus.READY), true, "legacy preparing orders can still be completed");
  assert.equal(canTransitionOrderStatus(OrderStatus.PENDING, OrderStatus.CANCELLED), true);
  assert.equal(canTransitionOrderStatus(OrderStatus.CONFIRMED, OrderStatus.CANCELLED), true);
  assert.equal(canTransitionOrderStatus(OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY), true);
  assert.equal(canTransitionOrderStatus(OrderStatus.READY, OrderStatus.CANCELLED), false);
  assert.equal(canTransitionOrderStatus(OrderStatus.DELIVERED, OrderStatus.PREPARING), false);
});

test("kitchen status filters combine legacy persisted states", () => {
  assert.deepEqual(getKitchenOrderStatusWhere("ALL"), {});
  assert.deepEqual(getKitchenOrderStatusWhere("NEW"), { status: "PENDING" });
  assert.deepEqual(getKitchenOrderStatusWhere("ACCEPTED"), { status: { in: ["CONFIRMED", "PREPARING"] } });
  assert.deepEqual(getKitchenOrderStatusWhere("READY"), { status: "READY" });
  assert.deepEqual(getKitchenOrderStatusWhere("HANDED_OVER"), { status: { in: ["OUT_FOR_DELIVERY", "DELIVERED"] } });
  assert.deepEqual(getKitchenOrderStatusWhere("CANCELLED"), { status: "CANCELLED" });
  assert.equal(getKitchenOrderStatusWhere("PREPARING"), null);
});


test("channel timing settings require separate valid acceptance and preparation pairs", () => {
  const settings = [
    { channel: "WEBSITE", acceptanceAmberMinutes: null, acceptanceLateMinutes: null, preparationAmberMinutes: 10, preparationLateMinutes: 15 },
    { channel: "ZOMATO", acceptanceAmberMinutes: 13, acceptanceLateMinutes: 15, preparationAmberMinutes: 12, preparationLateMinutes: 18 },
    { channel: "SWIGGY", acceptanceAmberMinutes: 8, acceptanceLateMinutes: 12, preparationAmberMinutes: null, preparationLateMinutes: null },
  ];
  assert.equal(validateKotChannelTimingSettings(settings).length, 3);
  assert.throws(() => validateKotChannelTimingSettings([
    ...settings.slice(0, 2),
    { ...settings[2], acceptanceAmberMinutes: 8, acceptanceLateMinutes: null },
  ]), KotValidationError);
  assert.throws(() => validateKotChannelTimingSettings([
    ...settings.slice(0, 2),
    { ...settings[2], acceptanceAmberMinutes: 15, acceptanceLateMinutes: 12 },
  ]), KotValidationError);
  assert.throws(() => validateKotChannelTimingSettings(settings.slice(0, 2)), KotValidationError);
});

test("KOT timer severity changes at the exact channel stage thresholds", () => {
  assert.equal(getKotTimerSeverity(12 * 60 + 59, 13, 15), "NEUTRAL");
  assert.equal(getKotTimerSeverity(13 * 60, 13, 15), "AMBER");
  assert.equal(getKotTimerSeverity(14 * 60 + 59, 13, 15), "AMBER");
  assert.equal(getKotTimerSeverity(15 * 60, 13, 15), "LATE");
  assert.equal(getKotTimerSeverity(999, null, null), "UNCONFIGURED");
});

test("acceptance and preparation timings are persisted at their status transitions", () => {
  const receivedAt = new Date("2026-11-11T04:00:00.000Z");
  const acceptedAt = new Date("2026-11-11T04:05:30.000Z");
  const readyAt = new Date("2026-11-11T04:14:15.000Z");
  const accepted = buildOrderTimingUpdate({ status: OrderStatus.PENDING, createdAt: receivedAt, acceptedAt: null }, OrderStatus.CONFIRMED, acceptedAt);
  assert.deepEqual(accepted.acceptedAt, acceptedAt);
  assert.equal(accepted.acceptanceDurationSeconds, 330);

  const ready = buildOrderTimingUpdate({ status: OrderStatus.CONFIRMED, createdAt: receivedAt, acceptedAt }, OrderStatus.READY, readyAt);
  assert.deepEqual(ready.readyAt, readyAt);
  assert.equal(ready.preparationDurationSeconds, 525);

  const legacyReady = buildOrderTimingUpdate({ status: OrderStatus.PREPARING, createdAt: receivedAt, acceptedAt: null }, OrderStatus.READY, readyAt);
  assert.equal(legacyReady.preparationDurationSeconds, null, "legacy order without an acceptance event must not get an invented duration");

  const cancelled = buildOrderTimingUpdate({ status: OrderStatus.CONFIRMED, createdAt: receivedAt, acceptedAt }, OrderStatus.CANCELLED, readyAt);
  assert.deepEqual(cancelled.cancelledAt, readyAt);
  assert.equal(cancelled.preparationDurationSeconds, 525);

  const cancelledBeforeAcceptance = buildOrderTimingUpdate(
    { status: OrderStatus.PENDING, createdAt: receivedAt, acceptedAt: null },
    OrderStatus.CANCELLED,
    acceptedAt,
  );
  assert.deepEqual(cancelledBeforeAcceptance.cancelledAt, acceptedAt);
  assert.equal(cancelledBeforeAcceptance.acceptanceDurationSeconds, undefined, "cancellation must not be recorded as acceptance");

  const handedOver = buildOrderTimingUpdate(
    { status: OrderStatus.READY, createdAt: receivedAt, acceptedAt },
    OrderStatus.OUT_FOR_DELIVERY,
    readyAt,
  );
  assert.deepEqual(handedOver.handedOverAt, readyAt);
});
