import { Prisma, RecipeType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export class RecipeError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 400 | 404 | 409 = 400,
  ) {
    super(message);
    this.name = "RecipeError";
  }
}

export interface CreateRecipeInput {
  code: string;
  name: string;
  recipeType: RecipeType;
  description?: string | null;
  outputQuantity: string;
  outputUnitId: string;
  yieldNotes?: string | null;
  changeSummary?: string | null;
}

export interface UpdateDraftVersionInput {
  outputQuantity?: string;
  outputUnitId?: string;
  yieldNotes?: string | null;
  changeSummary?: string | null;
}

export interface IngredientLineInput {
  ingredientId: string;
  quantity: string;
  notes?: string | null;
  sortOrder?: number;
}

export interface SubrecipeLineInput {
  componentRecipeVersionId: string;
  quantity: string;
  notes?: string | null;
  sortOrder?: number;
}

export interface RecipeStepInput {
  stepNumber: number;
  title?: string | null;
  instruction: string;
  timerSeconds?: number | null;
}

const versionInclude = {
  outputUnit: true,
  ingredientLines: {
    orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
    include: { ingredient: true, unit: true },
  },
  subrecipeLines: {
    orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
    include: {
      componentRecipeVersion: {
        include: { recipe: true, outputUnit: true },
      },
    },
  },
  steps: { orderBy: { stepNumber: "asc" as const } },
} satisfies Prisma.RecipeVersionInclude;

function cleanText(
  value: string,
  field: string,
  maxLength: number,
): string {
  const result = value.trim();
  if (!result || result.length > maxLength) {
    throw new RecipeError(`${field} must contain between 1 and ${maxLength} characters.`);
  }
  return result;
}

function optionalText(
  value: string | null | undefined,
  field: string,
  maxLength: number,
): string | null | undefined {
  if (value === undefined || value === null) return value;
  const result = value.trim();
  if (result.length > maxLength) {
    throw new RecipeError(`${field} cannot exceed ${maxLength} characters.`);
  }
  return result || null;
}

function recipeCode(value: string): string {
  const result = cleanText(value, "Recipe code", 64).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(result)) {
    throw new RecipeError("Recipe code may contain only letters, numbers, underscores and hyphens.");
  }
  return result;
}

function positiveDecimal(value: string, field: string): Prisma.Decimal {
  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(normalized)) {
    throw new RecipeError(`${field} must be a positive decimal with at most 6 decimal places.`);
  }
  const result = new Prisma.Decimal(normalized);
  if (!result.isFinite() || !result.greaterThan(0)) {
    throw new RecipeError(`${field} must be greater than zero.`);
  }
  return result;
}

function sortOrder(value: number | undefined): number {
  if (value === undefined) return 0;
  if (!Number.isInteger(value) || value < 0 || value > 1000000) {
    throw new RecipeError("sortOrder must be a non-negative integer.");
  }
  return value;
}

async function activeUnit(
  tx: Prisma.TransactionClient,
  unitId: string,
) {
  const unit = await tx.unit.findUnique({ where: { id: unitId } });
  if (!unit) throw new RecipeError("Measurement unit not found.", 404);
  if (!unit.isActive) throw new RecipeError("The selected measurement unit is inactive.", 409);
  return unit;
}

async function assertDraftVersion(
  tx: Prisma.TransactionClient,
  recipeId: string,
  versionId: string,
) {
  const version = await tx.recipeVersion.findFirst({
    where: { id: versionId, recipeId },
  });

  if (!version) throw new RecipeError("Recipe version not found.", 404);
  if (version.status !== "DRAFT") {
    throw new RecipeError("Only draft recipe versions can be edited.", 409);
  }

  return version;
}

export async function listRecipes(includeInactive = false) {
  return prisma.recipe.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ name: "asc" }, { code: "asc" }],
    include: {
      _count: { select: { versions: true } },
      versions: {
        take: 1,
        orderBy: { versionNumber: "desc" },
        select: {
          id: true,
          versionNumber: true,
          status: true,
          outputQuantity: true,
          outputUnitCodeSnapshot: true,
          publishedAt: true,
        },
      },
    },
  });
}

export async function getRecipe(recipeId: string) {
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        include: versionInclude,
      },
    },
  });

  if (!recipe) throw new RecipeError("Recipe not found.", 404);
  return recipe;
}

export async function createRecipe(input: CreateRecipeInput) {
  const code = recipeCode(input.code);
  const name = cleanText(input.name, "Recipe name", 160);
  const outputQuantity = positiveDecimal(input.outputQuantity, "Output quantity");
  const description = optionalText(input.description, "Description", 10000);
  const yieldNotes = optionalText(input.yieldNotes, "Yield notes", 5000);
  const changeSummary = optionalText(input.changeSummary, "Change summary", 5000);

  if (!Object.values(RecipeType).includes(input.recipeType)) {
    throw new RecipeError("Invalid recipe type.");
  }

  return prisma.$transaction(async (tx) => {
    const unit = await activeUnit(tx, input.outputUnitId);

    const recipe = await tx.recipe.create({
      data: {
        code,
        name,
        recipeType: input.recipeType,
        description,
        versions: {
          create: {
            versionNumber: 1,
            status: "DRAFT",
            recipeCodeSnapshot: code,
            recipeNameSnapshot: name,
            recipeTypeSnapshot: input.recipeType,
            outputQuantity,
            outputUnitId: unit.id,
            outputUnitCodeSnapshot: unit.code,
            outputUnitNameSnapshot: unit.name,
            outputUnitSymbolSnapshot: unit.symbol,
            yieldNotes,
            changeSummary,
          },
        },
      },
      include: { versions: { include: versionInclude } },
    });

    return recipe;
  });
}

export interface UpdateRecipeInput {
  name?: string;
  description?: string | null;
}

/**
 * Updates the current recipe identity without rewriting published or
 * superseded version snapshots. Editable draft snapshots follow the name.
 */
export async function updateRecipe(
  recipeId: string,
  input: UpdateRecipeInput,
) {
  const data: Prisma.RecipeUpdateInput = {};

  if (input.name !== undefined) {
    data.name = cleanText(input.name, "Recipe name", 160);
  }

  if (input.description !== undefined) {
    data.description = optionalText(input.description, "Description", 10000);
  }

  if (Object.keys(data).length === 0) {
    throw new RecipeError("Provide a recipe name or description to update.");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.recipe.findUnique({
      where: { id: recipeId },
    });

    if (!existing) throw new RecipeError("Recipe not found.", 404);
    if (!existing.isActive) {
      throw new RecipeError("Archived recipes must be restored before editing.", 409);
    }

    const updated = await tx.recipe.update({
      where: { id: recipeId },
      data,
    });

    if (input.name !== undefined) {
      await tx.recipeVersion.updateMany({
        where: { recipeId, status: "DRAFT" },
        data: { recipeNameSnapshot: updated.name },
      });
    }

    return updated;
  });
}

/** Archives a recipe only after all unfinished drafts have been dealt with. */
export async function archiveRecipe(recipeId: string) {
  return prisma.$transaction(
    async (tx) => {
      const recipe = await tx.recipe.findUnique({
        where: { id: recipeId },
      });

      if (!recipe) throw new RecipeError("Recipe not found.", 404);
      if (!recipe.isActive) return recipe;

      const draft = await tx.recipeVersion.findFirst({
        where: { recipeId, status: "DRAFT" },
        select: { id: true },
      });

      if (draft) {
        throw new RecipeError(
          "Archive or publish the draft version before archiving this recipe.",
          409,
        );
      }

      return tx.recipe.update({
        where: { id: recipeId },
        data: { isActive: false },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function restoreRecipe(recipeId: string) {
  return prisma.$transaction(async (tx) => {
    const recipe = await tx.recipe.findUnique({
      where: { id: recipeId },
    });

    if (!recipe) throw new RecipeError("Recipe not found.", 404);
    if (recipe.isActive) return recipe;

    return tx.recipe.update({
      where: { id: recipeId },
      data: { isActive: true },
    });
  });
}

export async function archiveDraftVersion(
  recipeId: string,
  versionId: string,
) {
  return prisma.$transaction(async (tx) => {
    await assertDraftVersion(tx, recipeId, versionId);

    return tx.recipeVersion.update({
      where: { id: versionId },
      data: {
        status: "ARCHIVED",
        archivedAt: new Date(),
      },
      include: versionInclude,
    });
  });
}

export async function createDraftVersion(
  recipeId: string,
  changeSummary?: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const recipe = await tx.recipe.findUnique({ where: { id: recipeId } });
    if (!recipe) throw new RecipeError("Recipe not found.", 404);
    if (!recipe.isActive) throw new RecipeError("Archived recipes cannot receive new versions.", 409);

    const existingDraft = await tx.recipeVersion.findFirst({
      where: { recipeId, status: "DRAFT" },
      select: { id: true },
    });
    if (existingDraft) {
      throw new RecipeError("This recipe already has a draft version. Finish or archive it first.", 409);
    }

    const previous = await tx.recipeVersion.findFirst({
      where: { recipeId },
      orderBy: { versionNumber: "desc" },
      include: {
        ingredientLines: {
          orderBy: { sortOrder: "asc" },
          include: { ingredient: true, unit: true },
        },
        subrecipeLines: { orderBy: { sortOrder: "asc" } },
        steps: { orderBy: { stepNumber: "asc" } },
      },
    });

    if (!previous) throw new RecipeError("The recipe has no previous version.", 409);

    const unit = await activeUnit(tx, previous.outputUnitId);
    const summary = optionalText(changeSummary, "Change summary", 5000);

    const draft = await tx.recipeVersion.create({
      data: {
        recipeId,
        versionNumber: previous.versionNumber + 1,
        status: "DRAFT",
        recipeCodeSnapshot: recipe.code,
        recipeNameSnapshot: recipe.name,
        recipeTypeSnapshot: recipe.recipeType,
        outputQuantity: previous.outputQuantity,
        outputUnitId: unit.id,
        outputUnitCodeSnapshot: unit.code,
        outputUnitNameSnapshot: unit.name,
        outputUnitSymbolSnapshot: unit.symbol,
        yieldNotes: previous.yieldNotes,
        changeSummary: summary ?? null,
      },
    });

    // Copy ingredient lines, refreshing snapshots from current catalogue data.
    for (const line of previous.ingredientLines) {
      if (
        !line.ingredient.isActive ||
        !line.unit.isActive ||
        line.ingredient.baseUnitId !== line.unitId
      ) {
        throw new RecipeError(
          `Cannot copy ${line.ingredient.name}: its current base unit or active status has changed. Review the new draft manually.`,
          409,
        );
      }

      await tx.recipeIngredientLine.create({
        data: {
          recipeVersionId: draft.id,
          ingredientId: line.ingredientId,
          unitId: line.unitId,
          quantity: line.quantity,
          ingredientCodeSnapshot: line.ingredient.code,
          ingredientNameSnapshot: line.ingredient.name,
          unitCodeSnapshot: line.unit.code,
          unitNameSnapshot: line.unit.name,
          unitSymbolSnapshot: line.unit.symbol,
          sortOrder: line.sortOrder,
          notes: line.notes,
        },
      });
    }

    for (const line of previous.subrecipeLines) {
      await tx.recipeSubrecipeLine.create({
        data: {
          recipeVersionId: draft.id,
          componentRecipeVersionId: line.componentRecipeVersionId,
          quantity: line.quantity,
          componentRecipeCodeSnapshot: line.componentRecipeCodeSnapshot,
          componentRecipeNameSnapshot: line.componentRecipeNameSnapshot,
          componentVersionNumberSnapshot: line.componentVersionNumberSnapshot,
          componentOutputUnitCodeSnapshot: line.componentOutputUnitCodeSnapshot,
          componentOutputUnitNameSnapshot: line.componentOutputUnitNameSnapshot,
          componentOutputUnitSymbolSnapshot: line.componentOutputUnitSymbolSnapshot,
          sortOrder: line.sortOrder,
          notes: line.notes,
        },
      });
    }

    for (const step of previous.steps) {
      await tx.recipeStep.create({
        data: {
          recipeVersionId: draft.id,
          stepNumber: step.stepNumber,
          title: step.title,
          instruction: step.instruction,
          timerSeconds: step.timerSeconds,
        },
      });
    }

    return tx.recipeVersion.findUniqueOrThrow({
      where: { id: draft.id },
      include: versionInclude,
    });
  });
}

export async function updateDraftVersion(
  recipeId: string,
  versionId: string,
  input: UpdateDraftVersionInput,
) {
  return prisma.$transaction(async (tx) => {
    await assertDraftVersion(tx, recipeId, versionId);

    const data: Prisma.RecipeVersionUncheckedUpdateInput = {};

    if (input.outputQuantity !== undefined) {
      data.outputQuantity = positiveDecimal(input.outputQuantity, "Output quantity");
    }

    if (input.outputUnitId !== undefined) {
      const unit = await activeUnit(tx, input.outputUnitId);
      data.outputUnitId = unit.id;
      data.outputUnitCodeSnapshot = unit.code;
      data.outputUnitNameSnapshot = unit.name;
      data.outputUnitSymbolSnapshot = unit.symbol;
    }

    if (input.yieldNotes !== undefined) {
      data.yieldNotes = optionalText(input.yieldNotes, "Yield notes", 5000);
    }

    if (input.changeSummary !== undefined) {
      data.changeSummary = optionalText(input.changeSummary, "Change summary", 5000);
    }

    if (Object.keys(data).length === 0) {
      throw new RecipeError("Provide at least one field to update.");
    }

    return tx.recipeVersion.update({
      where: { id: versionId },
      data,
      include: versionInclude,
    });
  });
}

export async function addIngredientLine(
  recipeId: string,
  versionId: string,
  input: IngredientLineInput,
) {
  const quantity = positiveDecimal(input.quantity, "Ingredient quantity");
  const notes = optionalText(input.notes, "Notes", 1000);
  const order = sortOrder(input.sortOrder);

  return prisma.$transaction(async (tx) => {
    await assertDraftVersion(tx, recipeId, versionId);

    const ingredient = await tx.ingredient.findUnique({
      where: { id: input.ingredientId },
      include: { baseUnit: true },
    });

    if (!ingredient) throw new RecipeError("Ingredient not found.", 404);
    if (!ingredient.isActive || !ingredient.baseUnit.isActive) {
      throw new RecipeError("Inactive ingredients or units cannot be added to a recipe.", 409);
    }

    return tx.recipeIngredientLine.create({
      data: {
        recipeVersionId: versionId,
        ingredientId: ingredient.id,
        unitId: ingredient.baseUnitId,
        quantity,
        ingredientCodeSnapshot: ingredient.code,
        ingredientNameSnapshot: ingredient.name,
        unitCodeSnapshot: ingredient.baseUnit.code,
        unitNameSnapshot: ingredient.baseUnit.name,
        unitSymbolSnapshot: ingredient.baseUnit.symbol,
        sortOrder: order,
        notes,
      },
      include: { ingredient: true, unit: true },
    });
  });
}

export async function removeIngredientLine(
  recipeId: string,
  versionId: string,
  lineId: string,
) {
  return prisma.$transaction(async (tx) => {
    await assertDraftVersion(tx, recipeId, versionId);

    const result = await tx.recipeIngredientLine.deleteMany({
      where: { id: lineId, recipeVersionId: versionId },
    });

    if (result.count === 0) throw new RecipeError("Recipe ingredient line not found.", 404);
    return { success: true };
  });
}

export async function addSubrecipeLine(
  recipeId: string,
  versionId: string,
  input: SubrecipeLineInput,
) {
  const quantity = positiveDecimal(input.quantity, "Sub-recipe quantity");
  const notes = optionalText(input.notes, "Notes", 1000);
  const order = sortOrder(input.sortOrder);

  return prisma.$transaction(async (tx) => {
    const parent = await assertDraftVersion(tx, recipeId, versionId);

    const component = await tx.recipeVersion.findUnique({
      where: { id: input.componentRecipeVersionId },
      include: { recipe: true, outputUnit: true },
    });

    if (!component) throw new RecipeError("Sub-recipe version not found.", 404);
    if (!["PUBLISHED", "SUPERSEDED"].includes(component.status)) {
      throw new RecipeError("A sub-recipe must reference a published version.", 409);
    }
    if (component.recipeId === parent.recipeId) {
      throw new RecipeError("A recipe cannot use another version of itself as a sub-recipe.", 409);
    }

    return tx.recipeSubrecipeLine.create({
      data: {
        recipeVersionId: versionId,
        componentRecipeVersionId: component.id,
        quantity,
        componentRecipeCodeSnapshot: component.recipeCodeSnapshot,
        componentRecipeNameSnapshot: component.recipeNameSnapshot,
        componentVersionNumberSnapshot: component.versionNumber,
        componentOutputUnitCodeSnapshot: component.outputUnitCodeSnapshot,
        componentOutputUnitNameSnapshot: component.outputUnitNameSnapshot,
        componentOutputUnitSymbolSnapshot: component.outputUnitSymbolSnapshot,
        sortOrder: order,
        notes,
      },
      include: {
        componentRecipeVersion: {
          include: { recipe: true, outputUnit: true },
        },
      },
    });
  });
}

export async function removeSubrecipeLine(
  recipeId: string,
  versionId: string,
  lineId: string,
) {
  return prisma.$transaction(async (tx) => {
    await assertDraftVersion(tx, recipeId, versionId);

    const result = await tx.recipeSubrecipeLine.deleteMany({
      where: { id: lineId, recipeVersionId: versionId },
    });

    if (result.count === 0) throw new RecipeError("Sub-recipe line not found.", 404);
    return { success: true };
  });
}

export async function replaceRecipeSteps(
  recipeId: string,
  versionId: string,
  steps: RecipeStepInput[],
) {
  if (steps.length > 100) throw new RecipeError("A recipe can have at most 100 steps.");

  const seen = new Set<number>();

  for (const step of steps) {
    if (!Number.isInteger(step.stepNumber) || step.stepNumber < 1 || step.stepNumber > 1000) {
      throw new RecipeError("Step numbers must be positive integers.");
    }
    if (seen.has(step.stepNumber)) throw new RecipeError("Step numbers must be unique.");
    seen.add(step.stepNumber);
    cleanText(step.instruction, "Step instruction", 4000);
    if (step.title !== undefined && step.title !== null) {
      optionalText(step.title, "Step title", 160);
    }
    if (
      step.timerSeconds !== undefined &&
      step.timerSeconds !== null &&
      (!Number.isInteger(step.timerSeconds) || step.timerSeconds < 0 || step.timerSeconds > 86400)
    ) {
      throw new RecipeError("timerSeconds must be between 0 and 86400.");
    }
  }

  return prisma.$transaction(async (tx) => {
    await assertDraftVersion(tx, recipeId, versionId);

    await tx.recipeStep.deleteMany({ where: { recipeVersionId: versionId } });

    for (const step of steps) {
      await tx.recipeStep.create({
        data: {
          recipeVersionId: versionId,
          stepNumber: step.stepNumber,
          title: optionalText(step.title, "Step title", 160),
          instruction: cleanText(step.instruction, "Step instruction", 4000),
          timerSeconds: step.timerSeconds ?? null,
        },
      });
    }

    return tx.recipeStep.findMany({
      where: { recipeVersionId: versionId },
      orderBy: { stepNumber: "asc" },
    });
  });
}

export async function publishRecipeVersion(
  recipeId: string,
  versionId: string,
) {
  return prisma.$transaction(
    async (tx) => {
      await assertDraftVersion(tx, recipeId, versionId);

      // Supersede the previous published version first.
      // The transaction rolls this back if publication of the new one fails.
      await tx.recipeVersion.updateMany({
        where: { recipeId, status: "PUBLISHED" },
        data: { status: "SUPERSEDED" },
      });

      return tx.recipeVersion.update({
        where: { id: versionId },
        data: { status: "PUBLISHED", publishedAt: new Date() },
        include: versionInclude,
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}