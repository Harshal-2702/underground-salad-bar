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

export const SIGNATURE_BOWLS = [
  {
    id: "continental",
    name: "Continental Bowl",
    tagline: "Light. Fresh. Balanced.",
    description: "Continental protein bowl featuring cilantro rice, herb-grilled chicken / paneer, and exotic sautéed vegetables, served with your choice of one signature sauce — Wild mushroom sauce, Smoky BBQ, or Korean chilli sauce (additional sauces available as optional add-ons).",
    price: 289,
    tag: "Best Seller",
    tagColor: "#1F3D2B",
    accentColor: "#1F3D2B",
  },
  {
    id: "mexican",
    name: "Burrito Bowl",
    tagline: "Bold. Smoky. Satisfying.",
    description: "A loaded Mexican burrito bowl with cilantro lime rice, black beans, grilled chicken / paneer, bell peppers, guacamole, sour cream, corn salsa, pico de gallo, jalapeños, olives, cheese, and crunchy nachos for the perfect balance of fresh and bold flavors.",
    price: 339,
    tag: "Fan Favourite",
    tagColor: "#B36235",
    accentColor: "#B36235",
  },
  {
    id: "kimchi",
    name: "Kimchi Rice",
    tagline: "Spicy. Fermented. Alive.",
    description: "A hearty Korean rice bowl with juicy gochujang chicken / Paneer, fermented kimchi, crisp vegetables, and steamed rice, all mixed together for bold, authentic flavors & top up with runny sunny side up.",
    price: 279,
    tag: "New",
    tagColor: "#E98A15",
    accentColor: "#E98A15",
  },
] as const;

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


const MENU_CATEGORY_METADATA: Record<string, { name: string; subtitle: string; note: string | null }> = {
  base: { name: "Base", subtitle: "Your foundation", note: null },
  protein: { name: "Protein", subtitle: "Fresh-grilled daily", note: null },
  veggies: { name: "Veggies", subtitle: "Pick as many as you like", note: "Unlimited variety per scoop" },
  beans: { name: "Beans", subtitle: "Extra protein & fibre", note: null },
  dressing: { name: "Dressing", subtitle: "The magic touch", note: null },
};

/** The single public menu source used by Customer ordering and staff NC entry. */
export function getPublicMenuCatalog() {
  return {
    categories: Object.entries(INGREDIENT_PRICING).map(([id, category]) => ({
      id,
      ...(MENU_CATEGORY_METADATA[id] ?? { name: id, subtitle: "", note: null }),
      pricePerScoop: category.pricePerScoop,
      items: [...category.ingredients],
    })),
    deliveryAreas: Object.entries(DELIVERY_CHARGES).map(([name, deliveryCharge]) => ({
      name,
      deliveryCharge,
    })),
  };
}

export interface PricedNcMenuItem {
  category: string;
  categoryNameSnapshot: string;
  itemName: string;
  scoops: number;
  unitPrice: number;
  lineValue: number;
  selectedOptions: string[] | null;
}

/** Validate NC selections with the exact same menu rules as customer checkout. */
export function calculateNcMenuPricing(itemsInput: unknown): {
  items: PricedNcMenuItem[];
  totalMenuValue: number;
} {
  // Reuse the order's authoritative selection validator; NC remains a distinct record.
  priceOneBowl({ items: itemsInput }, 0);
  if (!Array.isArray(itemsInput)) {
    throw new PricingValidationError("Select at least one menu item.");
  }

  const items = itemsInput.map((rawItem) => {
    const item = rawItem as Record<string, unknown>;
    const category = item.category as string;
    const scoops = item.scoops as number;
    const isVeggie = category === "veggies";
    const isSignature = category === "signature";
    const itemName = isVeggie ? "Veggie Scoop" : item.name as string;
    const signature = isSignature ? SIGNATURE_BOWLS.find((bowl) => bowl.name === itemName) : undefined;
    const unitPrice = signature?.price ?? INGREDIENT_PRICING[category as keyof typeof INGREDIENT_PRICING]?.pricePerScoop;
    if (unitPrice === undefined) throw new PricingValidationError("The selected menu item is no longer available.");
    const selectedOptions = isVeggie ? [...(item.veggieSelection as string[])] : null;
    const categoryNameSnapshot = isSignature ? "Signature bowls" : MENU_CATEGORY_METADATA[category]?.name ?? category;
    const lineValue = money(unitPrice * scoops);

    return { category, categoryNameSnapshot, itemName, scoops, unitPrice, lineValue, selectedOptions };
  });

  return {
    items,
    totalMenuValue: money(items.reduce((sum, item) => sum + item.lineValue, 0)),
  };
}

const VEGGIE_NAMES = new Set<string>(INGREDIENT_PRICING.veggies.ingredients);
const CATEGORY_NAMES = new Set([...Object.keys(INGREDIENT_PRICING), "signature"]);

export class PricingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingValidationError";
  }
}

export interface PricedBowl {
  bowlName: string;
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

  const hasSignature = input.items.some((rawItem) => isRecord(rawItem) && rawItem.category === "signature");
  if (hasSignature && input.items.length !== 1) {
    throw new PricingValidationError("A signature bowl must be ordered as its own bowl.");
  }

  const seenItems = new Set<string>();
  const beanScoops: number[] = [];
  let bowlTotal = 0;
  let bowlName = "Build Your Own Bowl";
  const details: string[] = [];

  for (const rawItem of input.items) {
    if (!isRecord(rawItem)) {
      throw new PricingValidationError(`Bowl ${index + 1} contains an invalid ingredient.`);
    }

    const { name, category, veggieSelection } = rawItem;
    if (typeof category !== "string" || !CATEGORY_NAMES.has(category)) {
      throw new PricingValidationError("An ingredient has an unknown category.");
    }
    if (typeof name !== "string" || name.trim().length === 0 || name.length > 120) {
      throw new PricingValidationError("An ingredient has an invalid name.");
    }

    const isSignature = category === "signature";
    const signature = isSignature ? SIGNATURE_BOWLS.find((item) => item.name === name) : undefined;
    const isVeggieScoop = category === "veggies";
    const expectedName = isVeggieScoop ? "Veggie Scoop" : name;
    const pricing = isSignature ? null : INGREDIENT_PRICING[category as keyof typeof INGREDIENT_PRICING];

    if (isSignature) {
      if (!signature) throw new PricingValidationError(`"${name}" is not an available signature bowl.`);
      if (veggieSelection !== undefined) throw new PricingValidationError("Signature bowls cannot include custom veggie selections.");
      const quantity = rawItem.scoops;
      if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
        throw new PricingValidationError("Signature bowl quantity must be between 1 and 20.");
      }
      bowlName = signature.name;
    } else if (isVeggieScoop) {
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
      if (!pricing || !(pricing.ingredients as readonly string[]).includes(name)) {
        throw new PricingValidationError(`"${name}" is not a valid ${category} ingredient.`);
      }
      if (veggieSelection !== undefined && (!Array.isArray(veggieSelection) || veggieSelection.length > 0)) {
        throw new PricingValidationError("Vegetable selections are only valid on a veggie scoop.");
      }
    }

    const scoops = isSignature ? rawItem.scoops as number : validateScoops(category, rawItem.scoops, expectedName);
    const uniqueKey = `${category}:${expectedName}`;
    if (seenItems.has(uniqueKey)) throw new PricingValidationError(`Repeated ingredient selection: ${expectedName}.`);
    seenItems.add(uniqueKey);

    if (category === "beans") beanScoops.push(scoops);
    const unitPrice = signature?.price ?? pricing?.pricePerScoop ?? 0;
    const lineTotal = money(unitPrice * scoops);
    bowlTotal = money(bowlTotal + lineTotal);

    const scoopLabel = scoops === 1 ? "" : ` x${scoops}`;
    const veggieLabel = isVeggieScoop ? ` (${(veggieSelection as string[]).join(", ")})` : "";
    details.push(`${category.toUpperCase()}: ${expectedName}${scoopLabel}${veggieLabel}`);
  }

  if (beanScoops.length > 2) throw new PricingValidationError("A bowl can contain no more than two bean varieties.");
  return { bowlName, quantity: 1, price: bowlTotal, details: details.join("\n") };
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
