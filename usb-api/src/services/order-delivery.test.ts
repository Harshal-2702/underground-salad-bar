import assert from "node:assert/strict";
import test from "node:test";
import { createOrderDeliverySnapshot } from "./order-delivery.js";

test("captures normalized delivery details on an order", () => {
  const snapshot = createOrderDeliverySnapshot({
    customerName: "  Asha Sharma  ",
    phone: " 9876543210 ",
    address: " Flat 12, Green Park ",
    area: " Aundh ",
  });

  assert.deepEqual(snapshot, {
    deliveryName: "Asha Sharma",
    deliveryPhone: "9876543210",
    deliveryAddress: "Flat 12, Green Park",
    deliveryArea: "Aundh",
    deliveryCity: "Pune",
  });
});

test("creates a fresh snapshot when a repeat customer changes address", () => {
  const firstOrder = createOrderDeliverySnapshot({
    customerName: "Asha Sharma",
    phone: "9876543210",
    address: "Flat 12, Green Park",
    area: "Aundh",
  });
  const laterOrder = createOrderDeliverySnapshot({
    customerName: "Asha Sharma",
    phone: "9876543210",
    address: "B-704, Lake View",
    area: "Baner",
  });

  assert.equal(firstOrder.deliveryAddress, "Flat 12, Green Park");
  assert.equal(firstOrder.deliveryArea, "Aundh");
  assert.equal(laterOrder.deliveryAddress, "B-704, Lake View");
  assert.equal(laterOrder.deliveryArea, "Baner");
  assert.notEqual(firstOrder, laterOrder);
});
