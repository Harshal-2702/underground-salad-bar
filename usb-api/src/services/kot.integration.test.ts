import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { OrderStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { allocateKotIdentity, buildOrderTimingUpdate, getKotChannelTimingSettings, saveKotChannelTimingSettings } from "./kot.service.js";

// Fail closed: this test can only run against approved disposable local databases.
const configuredUrl = process.env.DATABASE_URL;
if (!configuredUrl) throw new Error("DATABASE_URL is missing.");
const databaseUrl = new URL(configuredUrl);
if (
  databaseUrl.hostname !== "127.0.0.1" ||
  databaseUrl.port !== "55432" ||
  !["/ukos_test", "/ukos_migration_test_20261105"].includes(databaseUrl.pathname)
) {
  throw new Error("KOT integration tests are restricted to approved local test databases.");
}

test("daily KOT sequence is atomic, monotonic and India-date scoped", async () => {
  const businessDate = "2099-01-01";
  const existing = await prisma.kotDailySequence.findUnique({ where: { businessDate: new Date(`${businessDate}T00:00:00.000Z`) } });
  assert.equal(existing, null, "Disposable KOT integration date must not already exist.");

  try {
    await prisma.$transaction(async (tx) => {
      const first = await allocateKotIdentity(tx, businessDate);
      const second = await allocateKotIdentity(tx, businessDate);

      assert.equal(first.kotNumber, "KOT-20990101-001");
      assert.equal(first.kotSequence, 1);
      assert.equal(second.kotNumber, "KOT-20990101-002");
      assert.equal(second.kotSequence, 2);
      assert.equal(first.kotBusinessDate.toISOString(), "2099-01-01T00:00:00.000Z");

      // The intentional throw rolls the disposable sequence updates back.
      throw new Error("KOT_INTEGRATION_ROLLBACK");
    });
    assert.fail("Expected test transaction to roll back.");
  } catch (error) {
    assert.ok(error instanceof Error && error.message.includes("KOT_INTEGRATION_ROLLBACK"));
  }

  const after = await prisma.kotDailySequence.findUnique({ where: { businessDate: new Date(`${businessDate}T00:00:00.000Z`) } });
  assert.equal(after, null, "KOT sequence test left no persistent row.");
});


test("KOT channel timing settings persist independently for all three channels", async () => {
  const original = await getKotChannelTimingSettings(prisma);
  const testSettings = [
    { channel: "WEBSITE" as const, acceptanceAmberMinutes: 7, acceptanceLateMinutes: 10, preparationAmberMinutes: 12, preparationLateMinutes: 16 },
    { channel: "ZOMATO" as const, acceptanceAmberMinutes: 13, acceptanceLateMinutes: 15, preparationAmberMinutes: 14, preparationLateMinutes: 18 },
    { channel: "SWIGGY" as const, acceptanceAmberMinutes: null, acceptanceLateMinutes: null, preparationAmberMinutes: 11, preparationLateMinutes: 15 },
  ];

  try {
    await saveKotChannelTimingSettings(prisma, testSettings, "kot-integration-test@example.invalid");
    const saved = await getKotChannelTimingSettings(prisma);
    const byChannel = new Map(saved.map((setting) => [setting.channel, setting]));
    assert.equal(byChannel.get("WEBSITE")?.acceptanceAmberMinutes, 7);
    assert.equal(byChannel.get("ZOMATO")?.acceptanceAmberMinutes, 13);
    assert.equal(byChannel.get("ZOMATO")?.preparationLateMinutes, 18);
    assert.equal(byChannel.get("SWIGGY")?.acceptanceAmberMinutes, null);
    assert.equal(byChannel.get("SWIGGY")?.preparationAmberMinutes, 11);
  } finally {
    await saveKotChannelTimingSettings(prisma, original.map((setting) => ({
      channel: setting.channel,
      acceptanceAmberMinutes: setting.acceptanceAmberMinutes,
      acceptanceLateMinutes: setting.acceptanceLateMinutes,
      preparationAmberMinutes: setting.preparationAmberMinutes,
      preparationLateMinutes: setting.preparationLateMinutes,
    })), "kot-integration-test-cleanup@example.invalid");
    for (const setting of original) {
      await prisma.kotChannelTimingSetting.update({
        where: { channel: setting.channel },
        data: { updatedByEmail: setting.updatedByEmail },
      });
    }
  }
});

test("order stage timing columns are present in the local test database", async () => {
  const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Order'
      AND column_name IN (
        'acceptedAt', 'readyAt', 'handedOverAt', 'cancelledAt',
        'acceptanceDurationSeconds', 'preparationDurationSeconds'
      )
  `;
  assert.equal(rows.length, 6);
});

test.after(async () => {
  await prisma.$disconnect();
});


test("order acceptance and preparation timestamps and durations persist on the order record", async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 20);
  const receivedAt = new Date("2099-02-03T04:00:00.000Z");
  const acceptedAt = new Date("2099-02-03T04:05:30.000Z");
  const readyAt = new Date("2099-02-03T04:14:15.000Z");
  let orderId: string | null = null;

  try {
    const order = await prisma.order.create({
      data: {
        invoiceNumber: `KOT-TIMING-TEST-${suffix}`,
        channel: "WEBSITE",
        kotNumber: `KOT-20990203-${suffix}`,
        kotBusinessDate: new Date("2099-02-03T00:00:00.000Z"),
        kotSequence: Number.parseInt(suffix.slice(0, 8), 16) % 2_000_000_000 + 1,
        total: 0,
        paymentMethod: "TEST_ONLY",
        status: OrderStatus.PENDING,
        createdAt: receivedAt,
        statusEvents: { create: { toStatus: OrderStatus.PENDING, createdAt: receivedAt } },
      },
    });
    orderId = order.id;

    const acceptanceUpdate = buildOrderTimingUpdate(
      { status: OrderStatus.PENDING, createdAt: order.createdAt, acceptedAt: null },
      OrderStatus.CONFIRMED,
      acceptedAt,
    );
    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.CONFIRMED, ...acceptanceUpdate } });
      await tx.orderStatusEvent.create({
        data: { orderId: order.id, fromStatus: OrderStatus.PENDING, toStatus: OrderStatus.CONFIRMED, actorEmail: "kot-timing-test@example.invalid", createdAt: acceptedAt },
      });
    });

    const accepted = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    const preparationUpdate = buildOrderTimingUpdate(
      { status: accepted.status, createdAt: accepted.createdAt, acceptedAt: accepted.acceptedAt },
      OrderStatus.READY,
      readyAt,
    );
    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.READY, ...preparationUpdate } });
      await tx.orderStatusEvent.create({
        data: { orderId: order.id, fromStatus: OrderStatus.CONFIRMED, toStatus: OrderStatus.READY, actorEmail: "kot-timing-test@example.invalid", createdAt: readyAt },
      });
    });

    const persisted = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { statusEvents: { orderBy: { createdAt: "asc" } } },
    });

    assert.equal(persisted.status, OrderStatus.READY);
    assert.equal(persisted.acceptedAt?.toISOString(), acceptedAt.toISOString());
    assert.equal(persisted.readyAt?.toISOString(), readyAt.toISOString());
    assert.equal(persisted.acceptanceDurationSeconds, 330);
    assert.equal(persisted.preparationDurationSeconds, 525);
    assert.equal(persisted.statusEvents.length, 3);
    assert.equal(persisted.statusEvents[1]?.actorEmail, "kot-timing-test@example.invalid");
    assert.equal(persisted.statusEvents[2]?.actorEmail, "kot-timing-test@example.invalid");
  } finally {
    if (orderId) await prisma.order.delete({ where: { id: orderId } });
  }
});
