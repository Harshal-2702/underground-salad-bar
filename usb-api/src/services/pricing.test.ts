import assert from "node:assert/strict";
import test from "node:test";
import { calculateOrderPricing, PricingValidationError } from "./pricing.js";

const bowl = (items: unknown[]) => [{ items }];

test("prices ingredients from the server catalogue and ignores client-submitted prices", () => {
  const result = calculateOrderPricing(
    [{ total: 0, items: [{ name: "Rice", category: "base", scoops: 1, price: 0 }] }],
    "Aundh",
  );

  assert.equal(result.itemsSubtotal, 40);
  assert.equal(result.deliveryCharge, 0);
  assert.equal(result.total, 40);
  assert.equal(result.bowls[0].price, 40);
});

test("calculates mixed ingredients, half-beans and vegetable scoops", () => {
  const result = calculateOrderPricing(
    bowl([
      { name: "Rice", category: "base", scoops: 1 },
      { name: "Chicken", category: "protein", scoops: 1 },
      { name: "Veggie Scoop", category: "veggies", scoops: 2, veggieSelection: ["Carrot", "Corn"] },
      { name: "Chickpeas", category: "beans", scoops: 0.5 },
      { name: "Kidney Beans", category: "beans", scoops: 0.5 },
      { name: "Pesto", category: "dressing", scoops: 1 },
    ]),
    "Camp",
  );

  assert.equal(result.itemsSubtotal, 259);
  assert.equal(result.deliveryCharge, 50);
  assert.equal(result.total, 309);
  assert.match(result.bowls[0].details, /VEGGIES: Veggie Scoop x2 \(Carrot, Corn\)/);
});

test("prices multiple bowls and applies the selected-area delivery charge once", () => {
  const result = calculateOrderPricing(
    [
      { items: [{ name: "Wrap", category: "base", scoops: 1 }] },
      { items: [{ name: "Paneer", category: "protein", scoops: 2 }] },
    ],
    "Other",
  );

  assert.equal(result.itemsSubtotal, 158);
  assert.equal(result.deliveryCharge, 60);
  assert.equal(result.total, 218);
});

test("rejects unknown ingredients and categories", () => {
  assert.throws(
    () => calculateOrderPricing(bowl([{ name: "Truffle", category: "protein", scoops: 1 }]), "Aundh"),
    PricingValidationError,
  );
  assert.throws(
    () => calculateOrderPricing(bowl([{ name: "Rice", category: "unknown", scoops: 1 }]), "Aundh"),
    PricingValidationError,
  );
});

test("rejects invalid scoop quantities and invalid vegetable selections", () => {
  assert.throws(
    () => calculateOrderPricing(bowl([{ name: "Rice", category: "base", scoops: 0.5 }]), "Aundh"),
    PricingValidationError,
  );
  assert.throws(
    () => calculateOrderPricing(bowl([{ name: "Veggie Scoop", category: "veggies", scoops: 1, veggieSelection: ["Unknown"] }]), "Aundh"),
    PricingValidationError,
  );
});

test("supports independently adjusted half-scoop bean lines and rejects repeated bean entries", () => {
  const result = calculateOrderPricing(
    bowl([
      { name: "Chickpeas", category: "beans", scoops: 0.5 },
      { name: "Kidney Beans", category: "beans", scoops: 1.5 },
    ]),
    "Aundh",
  );
  assert.equal(result.itemsSubtotal, 60);

  assert.throws(
    () => calculateOrderPricing(bowl([
      { name: "Chickpeas", category: "beans", scoops: 1 },
      { name: "Kidney Beans", category: "beans", scoops: 1 },
      { name: "Chickpeas", category: "beans", scoops: 1 },
    ]), "Aundh"),
    PricingValidationError,
  );
});

test("rejects unsupported delivery areas", () => {
  assert.throws(
    () => calculateOrderPricing(bowl([{ name: "Rice", category: "base", scoops: 1 }]), "Mumbai"),
    PricingValidationError,
  );
});

test("uses the configured delivery fee for every listed area", () => {
  const freeAreas = [
    "Shivajinagar", "Aundh", "Baner", "Balewadi", "Pashan",
    "Pimple Saudagar", "Pimple Nilakh", "Bopodi", "Pune University",
  ];
  const fiftyRupeeAreas = ["Camp", "Sus Road", "Wakad", "Khadki", "Wakdewadi"];

  for (const area of freeAreas) {
    assert.equal(calculateOrderPricing(bowl([{ name: "Rice", category: "base", scoops: 1 }]), area).deliveryCharge, 0);
  }
  for (const area of fiftyRupeeAreas) {
    assert.equal(calculateOrderPricing(bowl([{ name: "Rice", category: "base", scoops: 1 }]), area).deliveryCharge, 50);
  }
  assert.equal(calculateOrderPricing(bowl([{ name: "Rice", category: "base", scoops: 1 }]), "Other").deliveryCharge, 60);
});
