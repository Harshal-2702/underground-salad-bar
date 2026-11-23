import assert from "node:assert/strict";
import test from "node:test";
import { calculateOrderPricing, calculateNcMenuPricing, getPublicMenuCatalog, PricingValidationError } from "./pricing.js";

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

test("the shared menu API exposes the same server-owned categories and scoop prices used by checkout", () => {
  const catalogue = getPublicMenuCatalog();
  const base = catalogue.categories.find((category) => category.id === "base");
  const protein = catalogue.categories.find((category) => category.id === "protein");
  const veggies = catalogue.categories.find((category) => category.id === "veggies");

  assert.equal(base?.pricePerScoop, 40);
  assert.ok(base?.items.includes("Rice"));
  assert.equal(protein?.pricePerScoop, 59);
  assert.ok(protein?.items.includes("Paneer"));
  assert.equal(veggies?.pricePerScoop, 40);
  assert.ok(veggies?.items.includes("Broccoli"));
  assert.ok(catalogue.deliveryAreas.some((area) => area.name === "Camp" && area.deliveryCharge === 50));
});

test("NC valuation uses the same authoritative menu prices and saves item snapshots", () => {
  const result = calculateNcMenuPricing([
    { name: "Rice", category: "base", scoops: 1 },
    { name: "Chicken", category: "protein", scoops: 1 },
    { name: "Veggie Scoop", category: "veggies", scoops: 1, veggieSelection: ["Carrot", "Corn"] },
    { name: "Chickpeas", category: "beans", scoops: 0.5 },
    { name: "Kidney Beans", category: "beans", scoops: 0.5 },
  ]);

  assert.equal(result.totalMenuValue, 154);
  assert.equal(result.items[0].unitPrice, 40);
  assert.equal(result.items[1].unitPrice, 59);
  assert.deepEqual(result.items[2].selectedOptions, ["Carrot", "Corn"]);
  assert.equal(result.items[2].lineValue, 40);
});

test("NC valuation rejects unknown menu selections and invalid quantities", () => {
  assert.throws(
    () => calculateNcMenuPricing([{ name: "Truffle", category: "protein", scoops: 1 }]),
    PricingValidationError,
  );
  assert.throws(
    () => calculateNcMenuPricing([{ name: "Rice", category: "base", scoops: 0.5 }]),
    PricingValidationError,
  );
});
