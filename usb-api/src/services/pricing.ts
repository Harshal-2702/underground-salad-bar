/**
 * Server-owned pricing rules for Underground Salad Bar's build-your-own bowls.
 * Never accept prices or totals from the browser as authoritative values.
 */

export const INGREDIENT_PRICING = {
  base: {
    pricePerScoop: 40,
    ingredients: ["Rice", "Wrap"],
  },
  protein: {
    pricePerScoop: 59,
    ingredients: ["Chicken", "Paneer", "Soya Chunks"],
  },
  veggies: {
    pricePerScoop: 40,
    ingredients: [
      "Carrot",
      "Beetroot",
      "Baby Potato",
      "Broccoli",
      "Bell Pepper",
      "Lettuce",
      "Onion",
      "Corn",
    ],
  },
  beans: {
    pricePerScoop: 30,
    ingredients: ["Chickpeas", "Kidney Beans"],
  },
  dressing: {
    pricePerScoop: 50,
    ingredients: [
      "Makhni",
      "Spinach",
      "Hung Curd Garlic",
      "Pesto",
      "Paprika",
      "Chipotle",
    ],
  },
} as const;

export const DELIVERY_CHARGES: Readonly<Record<string, number>> = {
  Shivajinagar: 0,
  Aundh: 0,
  Baner: 0,
  Balewadi: 0,
  Pashan: 0,
  "Pimple Saudagar": 0,
  "Pimple Nilakh": 0,
  Bopodi: 0,
  "Pune University": 0,
  Camp: 50,
  "Sus Road": 50,
  Wakad: 50,
  Khadki: 50,
  Wakdewadi: 50,
  Other: 60,
};

const VEGGIE_NAMES = new Set<string>(INGREDIENT_PRICING.veggies.ingredients);
const CATEGORY_NAMES = new Set(Object.keys(INGREDIENT_PRICING));

export class PricingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingValidationError";
  }
}

export interface PricedBowl {
  bowlName: "Build Your Own Bowl";
  quantity: 1;
  price: number;
  details: string;
}

export interface OrderPricing {
  bowls: PricedBowl[];
  itemsSubtotal: number;
  deliveryCharge: number;
  total: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function validateScoops(category: string, scoops: unknown, itemName: string): number {
  if (typeof scoops !== "number" || !Number.isFinite(scoops) || scoops <= 0 || scoops > 50) {
    throw new PricingValidationError(`Invalid scoop quantity for ${itemName}.`);
  }

  if (category === "beans") {
    if (!Number.isInteger(scoops * 2)) {
      throw new PricingValidationError("Bean scoops must use whole or half-scoop quantities.");
    }
  } else if (!Number.isInteger(scoops)) {
    throw new PricingValidationError(`Only whole scoops are allowed for ${itemName}.`);
  }

  return scoops;
}

function priceOneBowl(input: unknown, index: number): PricedBowl {
  if (!isRecord(input) || !Array.isArray(input.items) || input.items.length === 0 || input.items.length > 30) {
    throw new PricingValidationError(`Bowl ${index + 1} has invalid or missing ingredient selections.`);
  }

  const seenItems = new Set<string>();
  const beanScoops: number[] = [];
  let bowlTotal = 0;
  const details: string[] = [];

  for (const rawItem of input.items) {
    if (!isRecord(rawItem)) {
      throw new PricingValidationError(`Bowl ${index + 1} contains an invalid ingredient.`);
    }

    const { name, category, veggieSelection } = rawItem;
    if (typeof category !== "string" || !CATEGORY_NAMES.has(category)) {
      throw new PricingValidationError("An ingredient has an unknown category.");
    }
    if (typeof name !== "string" || name.trim().length === 0 || name.length > 80) {
      throw new PricingValidationError("An ingredient has an invalid name.");
    }

    const pricing = INGREDIENT_PRICING[category as keyof typeof INGREDIENT_PRICING];
    const isVeggieScoop = category === "veggies";
    const expectedName = isVeggieScoop ? "Veggie Scoop" : name;

    if (isVeggieScoop) {
      if (name !== "Veggie Scoop" || !Array.isArray(veggieSelection) || veggieSelection.length === 0 || veggieSelection.length > VEGGIE_NAMES.size) {
        throw new PricingValidationError("A veggie scoop must include at least one valid vegetable.");
      }
      const selected = new Set<string>();
      for (const veggie of veggieSelection) {
        if (typeof veggie !== "string" || !VEGGIE_NAMES.has(veggie) || selected.has(veggie)) {
          throw new PricingValidationError("A veggie scoop contains an unknown or repeated vegetable.");
        }
        selected.add(veggie);
      }
    } else {
      if (!(pricing.ingredients as readonly string[]).includes(name)) {
        throw new PricingValidationError(`"${name}" is not a valid ${category} ingredient.`);
      }
      if (veggieSelection !== undefined && (!Array.isArray(veggieSelection) || veggieSelection.length > 0)) {
        throw new PricingValidationError("Vegetable selections are only valid on a veggie scoop.");
      }
    }

    const scoops = validateScoops(category, rawItem.scoops, expectedName);
    const uniqueKey = `${category}:${expectedName}`;
    if (seenItems.has(uniqueKey)) {
      throw new PricingValidationError(`Repeated ingredient selection: ${expectedName}.`);
    }
    seenItems.add(uniqueKey);

    if (category === "beans") beanScoops.push(scoops);

    const lineTotal = money(pricing.pricePerScoop * scoops);
    bowlTotal = money(bowlTotal + lineTotal);

    const scoopLabel = scoops === 1 ? "" : ` x${scoops}`;
    const veggieLabel = isVeggieScoop ? ` (${(veggieSelection as string[]).join(", ")})` : "";
    details.push(`${category.toUpperCase()}: ${expectedName}${scoopLabel}${veggieLabel}`);
  }

  if (beanScoops.length > 2) {
    throw new PricingValidationError("A bowl can contain no more than two bean varieties.");
  }
  return {
    bowlName: "Build Your Own Bowl",
    quantity: 1,
    price: bowlTotal,
    details: details.join("\n"),
  };
}

/** Validates customer selections and calculates every amount on the server. */
export function calculateOrderPricing(bowlsInput: unknown, areaInput: unknown): OrderPricing {
  if (!Array.isArray(bowlsInput) || bowlsInput.length === 0 || bowlsInput.length > 20) {
    throw new PricingValidationError("Select between 1 and 20 bowls.");
  }
  if (typeof areaInput !== "string" || !Object.prototype.hasOwnProperty.call(DELIVERY_CHARGES, areaInput.trim())) {
    throw new PricingValidationError("Please select a valid delivery area.");
  }

  const bowls = bowlsInput.map((bowl, index) => priceOneBowl(bowl, index));
  const itemsSubtotal = money(bowls.reduce((sum, bowl) => sum + bowl.price, 0));
  const deliveryCharge = DELIVERY_CHARGES[areaInput.trim()];

  return {
    bowls,
    itemsSubtotal,
    deliveryCharge,
    total: money(itemsSubtotal + deliveryCharge),
  };
}
