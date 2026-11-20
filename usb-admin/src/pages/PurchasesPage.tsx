import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { API_URL } from "../config";
import LeftoverInventoryPanel from "./LeftoverInventoryPanel";
import "../purchases.css";

type InventoryCategory = { id: string; code: string; name: string; sortOrder: number; isActive: boolean };
type Unit = { id: string; code: string; name: string; symbol: string; dimension: string; factorToCanonical: string | null; isActive: boolean };
type Ingredient = {
  id: string;
  code: string;
  sku: string | null;
  name: string;
  inventoryCategoryId: string | null;
  defaultPurchaseUnitId: string | null;
  baseUnit: Unit;
  defaultPurchaseUnit: Unit | null;
  unitConversions: Array<{ unitId: string; unit: Unit }>;
};
type DraftLine = {
  rowKey: string;
  ingredientId: string;
  ingredientInput: string;
  purchaseUnitId: string;
  quantity: string;
  itemAmount: string;
};
type DraftSheet = {
  inventoryCategoryId: string;
  purchaseDate: string;
  supplierName: string;
  invoiceNumber: string;
  lines: DraftLine[];
};
type PurchaseDraft = { recordedByName: string; sheets: DraftSheet[] };
type HistorySheet = {
  id: string;
  inventoryCategoryCodeSnapshot: string;
  inventoryCategoryNameSnapshot: string;
  purchaseDate: string;
  supplierName: string;
  invoiceNumber: string | null;
  _count: { lines: number };
};
type HistoryItem = {
  id: string;
  reference: string;
  recordedByEmail: string;
  recordedByName: string;
  totalAmount: string;
  createdAt: string;
  voidedAt: string | null;
  sheets: HistorySheet[];
};
type HistoryResponse = { items: HistoryItem[]; total: number; page: number; pageSize: number; totalPages: number };
type DetailLine = {
  id: string;
  ingredientCodeSnapshot: string;
  ingredientNameSnapshot: string;
  purchaseUnitCodeSnapshot: string;
  purchaseUnitNameSnapshot: string;
  purchaseUnitSymbolSnapshot: string;
  quantity: string;
  itemAmount: string;
  sortOrder: number;
};
type DetailSheet = {
  id: string;
  inventoryCategoryCodeSnapshot: string;
  inventoryCategoryNameSnapshot: string;
  purchaseDate: string;
  supplierName: string;
  invoiceNumber: string | null;
  lines: DetailLine[];
};
type PurchaseDetail = {
  id: string;
  reference: string;
  recordedByEmail: string;
  recordedByName: string;
  totalAmount: string;
  createdAt: string;
  voidedAt: string | null;
  voidedByEmail: string | null;
  voidReason: string | null;
  sheets: DetailSheet[];
};
type Props = {
  accessToken: string;
  signedInEmail: string;
  onBackToOrders: () => void;
  onSignOut: () => Promise<void>;
};
type ReviewSheet = { sheet: DraftSheet; category: InventoryCategory; rows: DraftLine[] };
type HistoryFilters = {
  from: string;
  to: string;
  categoryId: string;
  supplier: string;
  ingredient: string;
  invoice: string;
  recordedBy: string;
  reference: string;
  minAmount: string;
  maxAmount: string;
  sortBy: "createdAt" | "reference" | "totalAmount";
  sortOrder: "asc" | "desc";
};

function indiaDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((value) => value.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function blankLine(): DraftLine {
  return {
    rowKey: globalThis.crypto?.randomUUID?.() ?? `row-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    ingredientId: "",
    ingredientInput: "",
    purchaseUnitId: "",
    quantity: "",
    itemAmount: "",
  };
}

function blankSheet(categoryId: string): DraftSheet {
  return {
    inventoryCategoryId: categoryId,
    purchaseDate: indiaDateKey(),
    supplierName: "",
    invoiceNumber: "",
    lines: [blankLine()],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeDraft(raw: unknown, categories: InventoryCategory[]): PurchaseDraft {
  const rawSheets = isRecord(raw) && Array.isArray(raw.sheets) ? raw.sheets : [];
  const byCategory = new Map<string, Record<string, unknown>>();
  for (const item of rawSheets) {
    if (isRecord(item) && typeof item.inventoryCategoryId === "string") {
      byCategory.set(item.inventoryCategoryId, item);
    }
  }

  return {
    recordedByName: isRecord(raw) && typeof raw.recordedByName === "string" ? raw.recordedByName : "",
    sheets: categories.map((category) => {
      const saved = byCategory.get(category.id);
      if (!saved) return blankSheet(category.id);
      const rawLines = Array.isArray(saved.lines) ? saved.lines : [];
      const lines = rawLines.filter(isRecord).map((line, index): DraftLine => ({
        rowKey: typeof line.rowKey === "string" ? line.rowKey : `${category.id}-${index}`,
        ingredientId: typeof line.ingredientId === "string" ? line.ingredientId : "",
        ingredientInput: typeof line.ingredientInput === "string" ? line.ingredientInput : "",
        purchaseUnitId: typeof line.purchaseUnitId === "string" ? line.purchaseUnitId : "",
        quantity: typeof line.quantity === "string" ? line.quantity : "",
        itemAmount: typeof line.itemAmount === "string" ? line.itemAmount : "",
      }));
      return {
        inventoryCategoryId: category.id,
        purchaseDate: typeof saved.purchaseDate === "string" ? saved.purchaseDate : indiaDateKey(),
        supplierName: typeof saved.supplierName === "string" ? saved.supplierName : "",
        invoiceNumber: typeof saved.invoiceNumber === "string" ? saved.invoiceNumber : "",
        lines: lines.length ? lines : [blankLine()],
      };
    }),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

async function apiRequest<T>(
  path: string,
  accessToken: string,
  onSignOut: () => Promise<void>,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body !== undefined) headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  const raw = await response.text();
  let payload: unknown = null;
  if (raw) {
    try { payload = JSON.parse(raw) as unknown; } catch { payload = null; }
  }
  if (response.status === 401) {
    await onSignOut();
    throw new Error("Your session expired. Please sign in again.");
  }
  if (response.status === 403) {
    throw new Error("This account is not authorised to manage purchase records.");
  }
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : `Request failed (${response.status}).`;
    throw new Error(message);
  }
  return payload as T;
}

function formatAmount(value: string | number | bigint): string {
  const text = String(value);
  const [wholePart, fractionPart = ""] = text.split(".");
  const whole = BigInt(wholePart || "0");
  const grouped = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(whole);
  return `₹${grouped}.${fractionPart.padEnd(2, "0").slice(0, 2)}`;
}

function amountCents(value: string): bigint {
  const [wholePart, fractionPart = ""] = value.trim().split(".");
  return BigInt(wholePart || "0") * 100n + BigInt(fractionPart.padEnd(2, "0").slice(0, 2));
}

function formatCents(value: bigint): string {
  const whole = value / 100n;
  const fraction = String(value % 100n).padStart(2, "0");
  const grouped = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(whole);
  return `₹${grouped}.${fraction}`;
}

function dateLabel(value: string): string {
  return value.slice(0, 10);
}

function purchaseUnitsFor(ingredient: Ingredient | null, units: Unit[]): Unit[] {
  if (!ingredient) return [];
  const conversionIds = new Set(
    ingredient.unitConversions
      .filter((conversion) => conversion.unit.isActive)
      .map((conversion) => conversion.unitId),
  );
  const defaultId = ingredient.defaultPurchaseUnit?.isActive
    ? ingredient.defaultPurchaseUnit.id
    : null;

  return units.filter((unit) => {
    if (!unit.isActive) return false;
    if (unit.id === ingredient.baseUnit.id || unit.id === defaultId || conversionIds.has(unit.id)) return true;
    return unit.dimension === ingredient.baseUnit.dimension
      && unit.factorToCanonical !== null
      && Number.isFinite(Number(unit.factorToCanonical))
      && Number(unit.factorToCanonical) > 0;
  });
}

function lineTouched(line: DraftLine): boolean {
  return Boolean(line.ingredientId || line.ingredientInput.trim() || line.purchaseUnitId || line.quantity.trim() || line.itemAmount.trim());
}

function validQuantity(value: string): boolean {
  return /^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(value.trim()) && Number(value) > 0;
}

function validAmount(value: string): boolean {
  return /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(value.trim()) && Number(value) > 0;
}

function IngredientPicker({
  value,
  options,
  selectedIngredientId,
  onChange,
  onSelect,
}: {
  value: string;
  options: Ingredient[];
  selectedIngredientId: string;
  onChange: (value: string) => void;
  onSelect: (ingredient: Ingredient) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showError, setShowError] = useState(false);
  const normalized = value.trim().toLowerCase();
  const exactMatches = useMemo(() => {
    if (!normalized) return [];
    return options.filter((item) =>
      item.name.toLowerCase() === normalized ||
      item.code.toLowerCase() === normalized ||
      (item.sku ?? "").toLowerCase() === normalized,
    );
  }, [options, normalized]);
  const selected = options.find((item) => item.id === selectedIngredientId);

  const matches = useMemo(() => {
    if (!normalized) return options.slice(0, 8);
    return options.filter((item) =>
      item.name.toLowerCase().includes(normalized) ||
      item.code.toLowerCase().includes(normalized) ||
      (item.sku ?? "").toLowerCase().includes(normalized),
    ).slice(0, 8);
  }, [options, normalized]);

  function resolveOnBlur() {
    if (!value.trim()) {
      setShowError(false);
      return;
    }
    if (selected && selected.name.toLowerCase() === normalized) {
      setShowError(false);
      return;
    }
    if (exactMatches.length === 1) {
      onSelect(exactMatches[0]);
      setShowError(false);
      return;
    }
    setShowError(true);
  }

  return (
    <div className="purchase-ingredient-picker">
      <input
        value={value}
        placeholder="Search ingredient or code"
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value);
          setShowError(false);
          setOpen(true);
        }}
        onBlur={() => window.setTimeout(() => {
          resolveOnBlur();
          setOpen(false);
        }, 120)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          if (exactMatches.length === 1) {
            event.preventDefault();
            event.stopPropagation();
            onSelect(exactMatches[0]);
            setShowError(false);
            setOpen(false);
            return;
          }

          event.preventDefault();
          const row = event.currentTarget.closest("tr");
          if (!row) return;
          const controls = Array.from(row.querySelectorAll("input, select")).filter(
            (control) => !(control as HTMLInputElement | HTMLSelectElement).disabled,
          ) as Array<HTMLInputElement | HTMLSelectElement>;
          const currentIndex = controls.indexOf(event.currentTarget);
          const next = controls[currentIndex + 1];
          if (next) next.focus();
        }}
        aria-label="Search ingredient catalogue"
        aria-invalid={showError}
      />
      {open && matches.length > 0 && (
        <div className="purchase-picker-options" role="listbox">
          {matches.map((ingredient) => (
            <button
              type="button"
              key={ingredient.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(ingredient);
                setShowError(false);
                setOpen(false);
              }}
              role="option"
              aria-selected={selectedIngredientId === ingredient.id}
            >
              <strong>{ingredient.name}</strong>
              <small>{ingredient.code}{ingredient.sku ? ` · ${ingredient.sku}` : ""}</small>
            </button>
          ))}
        </div>
      )}
      {showError && (
        <small className="purchase-inline-error" role="alert">
          Add correct ingredient from Ingredients Catalogue.
        </small>
      )}
    </div>
  );
}

const initialFilters: HistoryFilters = {
  from: "", to: "", categoryId: "", supplier: "", ingredient: "", invoice: "",
  recordedBy: "", reference: "", minAmount: "", maxAmount: "", sortBy: "createdAt", sortOrder: "desc",
};

export default function PurchasesPage({ accessToken, signedInEmail, onBackToOrders, onSignOut }: Props) {
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [draft, setDraft] = useState<PurchaseDraft>({ recordedByName: "", sheets: [] });
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftStatus, setDraftStatus] = useState("Loading draft…");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [historyFilters, setHistoryFilters] = useState<HistoryFilters>(initialFilters);
  const [historyData, setHistoryData] = useState<HistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [detail, setDetail] = useState<PurchaseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const historyInitialLoad = useRef(false);
  const [activePanel, setActivePanel] = useState<"purchase" | "leftover">("purchase");

  const activeSheet = draft.sheets.find((sheet) => sheet.inventoryCategoryId === activeCategoryId) ?? null;
  const activeCategory = categories.find((category) => category.id === activeCategoryId) ?? null;
  const activeIngredients = useMemo(
    () => ingredients.filter((item) => item.inventoryCategoryId === activeCategoryId),
    [ingredients, activeCategoryId],
  );
  const review = useMemo(() => {
    const errors: string[] = [];
    const completed: ReviewSheet[] = [];
    if (!draft.recordedByName.trim()) errors.push("Enter the name of the person recording this purchase.");
    for (const category of categories) {
      const sheet = draft.sheets.find((item) => item.inventoryCategoryId === category.id);
      if (!sheet) continue;
      const rows = sheet.lines.filter(lineTouched);
      if (!rows.length) continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(sheet.purchaseDate) || Number.isNaN(new Date(`${sheet.purchaseDate}T00:00:00Z`).getTime()) || new Date(`${sheet.purchaseDate}T00:00:00Z`).toISOString().slice(0, 10) !== sheet.purchaseDate) {
        errors.push(`${category.name}: enter a valid purchase date.`);
      }
      if (!sheet.supplierName.trim()) errors.push(`${category.name}: supplier is required.`);
      rows.forEach((line, index) => {
        const ingredient = ingredients.find((item) => item.id === line.ingredientId);
        if (!ingredient || ingredient.inventoryCategoryId !== category.id) {
          errors.push(`${category.name}, row ${index + 1}: select an ingredient assigned to this purchasing category.`);
        }
        const selectableUnits = ingredient ? purchaseUnitsFor(ingredient, units) : [];
        if (!line.purchaseUnitId || !selectableUnits.some((unit) => unit.id === line.purchaseUnitId)) {
          errors.push(`${category.name}, row ${index + 1}: select a purchase unit compatible with this ingredient.`);
        }
        if (!validQuantity(line.quantity)) errors.push(`${category.name}, row ${index + 1}: quantity must be greater than zero (up to 6 decimals).`);
        if (!validAmount(line.itemAmount)) errors.push(`${category.name}, row ${index + 1}: total item amount is required (up to 2 decimals).`);
      });
      completed.push({ sheet, category, rows });
    }
    if (!completed.length) errors.push("Add at least one ingredient row before reviewing the purchase.");
    return { errors, completed };
  }, [categories, draft, ingredients, units]);

  const loadHistory = useCallback(async (page = 1, filters: HistoryFilters = historyFilters) => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      for (const key of ["from", "to", "categoryId", "supplier", "ingredient", "invoice", "recordedBy", "reference", "minAmount", "maxAmount"] as const) {
        if (filters[key].trim()) params.set(key, filters[key].trim());
      }
      params.set("sortBy", filters.sortBy);
      params.set("sortOrder", filters.sortOrder);
      params.set("page", String(page));
      params.set("pageSize", "25");
      const result = await apiRequest<HistoryResponse>(`/purchases/history?${params.toString()}`, accessToken, onSignOut);
      setHistoryData(result);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setHistoryLoading(false);
    }
  }, [accessToken, historyFilters, onSignOut]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [categoryRows, ingredientRows, unitRows, savedDraft] = await Promise.all([
          apiRequest<InventoryCategory[]>("/inventory-categories", accessToken, onSignOut),
          apiRequest<Ingredient[]>("/ingredients", accessToken, onSignOut),
          apiRequest<Unit[]>("/units", accessToken, onSignOut),
          apiRequest<{ data: unknown; updatedAt: string | null }>("/purchases/draft", accessToken, onSignOut),
        ]);
        if (!mounted) return;
        const normalized = normalizeDraft(savedDraft.data, categoryRows);
        setCategories(categoryRows);
        setIngredients(ingredientRows);
        setUnits(unitRows);
        setDraft(normalized);
        setActiveCategoryId(categoryRows[0]?.id ?? "");
        setReady(true);
      } catch (loadError) {
        if (mounted) setError(errorMessage(loadError));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, [accessToken, onSignOut]);

  useEffect(() => {
    if (!ready) return;
    setDraftStatus("Unsaved changes");
    const snapshot = JSON.parse(JSON.stringify(draft)) as PurchaseDraft;
    const timer = window.setTimeout(() => {
      saveQueue.current = saveQueue.current.catch(() => undefined).then(async () => {
        setSavingDraft(true);
        try {
          await apiRequest("/purchases/draft", accessToken, onSignOut, {
            method: "PUT",
            body: JSON.stringify({ data: snapshot }),
          });
          setDraftStatus("Draft saved");
        } catch (saveError) {
          setDraftStatus("Draft save failed");
          setError(errorMessage(saveError));
        } finally {
          setSavingDraft(false);
        }
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [draft, ready, accessToken, onSignOut]);

  useEffect(() => {
    if (ready && !historyInitialLoad.current) {
      historyInitialLoad.current = true;
      void loadHistory(1);
    }
  }, [ready, loadHistory]);

  function handleRowEnter(event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const row = event.currentTarget.closest("tr");
    if (!row) return;
    const controls = Array.from(row.querySelectorAll("input, select")).filter(
      (control) => !(control as HTMLInputElement | HTMLSelectElement).disabled,
    ) as Array<HTMLInputElement | HTMLSelectElement>;
    const currentIndex = controls.indexOf(event.currentTarget);
    const next = controls[currentIndex + 1];
    if (next) {
      next.focus();
      return;
    }
    const nextRow = row.nextElementSibling;
    const nextRowControl = nextRow?.querySelector("input, select") as HTMLInputElement | HTMLSelectElement | null;
    if (nextRowControl) {
      nextRowControl.focus();
      return;
    }
    addLine();
  }

  function updateActiveSheet(update: (sheet: DraftSheet) => DraftSheet) {
    setDraft((current) => ({
      ...current,
      sheets: current.sheets.map((sheet) => sheet.inventoryCategoryId === activeCategoryId ? update(sheet) : sheet),
    }));
  }

  function updateLine(rowKey: string, update: Partial<DraftLine>) {
    updateActiveSheet((sheet) => ({
      ...sheet,
      lines: sheet.lines.map((line) => line.rowKey === rowKey ? { ...line, ...update } : line),
    }));
  }

  function selectIngredient(rowKey: string, ingredient: Ingredient) {
    updateLine(rowKey, {
      ingredientId: ingredient.id,
      ingredientInput: ingredient.name,
      purchaseUnitId: ingredient.defaultPurchaseUnit?.isActive
        ? ingredient.defaultPurchaseUnit.id
        : ingredient.baseUnit.id,
    });
  }

  function addLine() {
    updateActiveSheet((sheet) => ({ ...sheet, lines: [...sheet.lines, blankLine()] }));
  }

  function removeLine(rowKey: string) {
    updateActiveSheet((sheet) => {
      const remaining = sheet.lines.filter((line) => line.rowKey !== rowKey);
      return { ...sheet, lines: remaining.length ? remaining : [blankLine()] };
    });
  }

  function applyBulkPaste() {
    setPasteError("");
    if (!activeSheet || !activeCategory) return;
    const rows = pasteText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!rows.length) { setPasteError("Paste at least one tab-separated row."); return; }
    const additions: DraftLine[] = [];
    for (let index = 0; index < rows.length; index += 1) {
      const cells = rows[index].split("\t").map((cell) => cell.trim());
      if (cells.length < 3 || cells.length > 4) {
        setPasteError(`Pasted row ${index + 1} must have 3 or 4 columns: ingredient, quantity, unit code (optional), total amount.`);
        return;
      }
      const [ingredientValue, quantity, unitCode, amount] = cells.length === 3
        ? [cells[0], cells[1], "", cells[2]]
        : cells;
      const ingredient = activeIngredients.find((item) =>
        item.name.toLowerCase() === ingredientValue.toLowerCase() ||
        item.code.toLowerCase() === ingredientValue.toLowerCase() ||
        (item.sku ?? "").toLowerCase() === ingredientValue.toLowerCase(),
      );
      if (!ingredient) {
        setPasteError(`Pasted row ${index + 1}: "${ingredientValue}" is not an exact active ingredient match in ${activeCategory.name}.`);
        return;
      }
      const allowedUnits = purchaseUnitsFor(ingredient, units);
      const unit = unitCode
        ? allowedUnits.find((item) => item.code.toLowerCase() === unitCode.toLowerCase())
        : allowedUnits.find((item) => item.id === (ingredient.defaultPurchaseUnit?.isActive ? ingredient.defaultPurchaseUnit.id : ingredient.baseUnit.id));
      if (!unit) {
        setPasteError(`Pasted row ${index + 1}: purchase unit "${unitCode}" is unavailable or not configured as compatible for ${ingredient.name}.`);
        return;
      }
      if (!validQuantity(quantity) || !validAmount(amount ?? "")) {
        setPasteError(`Pasted row ${index + 1}: enter a valid quantity and total item amount.`);
        return;
      }
      additions.push({
        ...blankLine(),
        ingredientId: ingredient.id,
        ingredientInput: ingredient.name,
        purchaseUnitId: unit.id,
        quantity,
        itemAmount: amount ?? "",
      });
    }
    updateActiveSheet((sheet) => ({
      ...sheet,
      lines: [
        ...sheet.lines.filter(lineTouched),
        ...additions,
      ],
    }));
    setPasteText("");
    setNotice(`${additions.length} pasted row${additions.length === 1 ? "" : "s"} added. Review before submitting.`);
  }

  async function openReview() {
    setError("");
    if (review.errors.length) {
      setError(review.errors[0]);
      setReviewOpen(true);
      return;
    }
    try {
      setSavingDraft(true);
      await apiRequest("/purchases/draft", accessToken, onSignOut, {
        method: "PUT",
        body: JSON.stringify({ data: draft }),
      });
      setDraftStatus("Draft saved");
      setReviewOpen(true);
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSavingDraft(false);
    }
  }

  async function confirmSubmit() {
    if (review.errors.length) return;
    setSubmitting(true);
    setError("");
    try {
      await saveQueue.current.catch(() => undefined);
      const payload = {
        recordedByName: draft.recordedByName.trim(),
        sheets: review.completed.map(({ sheet, rows }) => ({
          inventoryCategoryId: sheet.inventoryCategoryId,
          purchaseDate: sheet.purchaseDate,
          supplierName: sheet.supplierName,
          invoiceNumber: sheet.invoiceNumber,
          lines: rows.map((line) => ({
            ingredientId: line.ingredientId,
            purchaseUnitId: line.purchaseUnitId,
            quantity: line.quantity,
            itemAmount: line.itemAmount,
          })),
        })),
      };
      const result = await apiRequest<PurchaseDetail>("/purchases/submit", accessToken, onSignOut, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setReviewOpen(false);
      setDetail(result);
      setDraft({ recordedByName: draft.recordedByName, sheets: categories.map((category) => blankSheet(category.id)) });
      setNotice(`Purchase saved successfully. Reference: ${result.reference}`);
      await loadHistory(1);
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  async function openDetail(id: string) {
    setDetailLoading(true);
    setError("");
    try {
      const result = await apiRequest<PurchaseDetail>(`/purchases/${id}`, accessToken, onSignOut);
      setDetail(result);
      setVoidReason("");
    } catch (detailError) {
      setError(errorMessage(detailError));
    } finally {
      setDetailLoading(false);
    }
  }

  async function voidTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !voidReason.trim()) return;
    if (!window.confirm(`Void purchase ${detail.reference}? This action will retain the original transaction and audit details.`)) return;
    setVoiding(true);
    setError("");
    try {
      const result = await apiRequest<PurchaseDetail>(`/purchases/${detail.id}/void`, accessToken, onSignOut, {
        method: "POST",
        body: JSON.stringify({ reason: voidReason.trim() }),
      });
      setDetail(result);
      setVoidReason("");
      setNotice(`${result.reference} has been voided.`);
      await loadHistory(historyData?.page ?? 1);
    } catch (voidError) {
      setError(errorMessage(voidError));
    } finally {
      setVoiding(false);
    }
  }

  function updateFilter<K extends keyof HistoryFilters>(key: K, value: HistoryFilters[K]) {
    setHistoryFilters((current) => ({ ...current, [key]: value }));
  }

  if (loading) {
    return <main className="purchase-shell"><p>Loading Purchase Register…</p></main>;
  }

  return (
    <main className="purchase-shell">
      <header className="purchase-header">
        <div>
          <p className="purchase-eyebrow">UNDERGROUND KITCHEN OS / INVENTORY</p>
          <h1>Purchase Register</h1>
          <p className="purchase-muted">Record supplier purchases by purchasing category. Signed in as {signedInEmail}.</p>
        </div>
        <div className="purchase-header-actions">
          <span className="purchase-draft-status">{savingDraft ? "Saving draft…" : draftStatus}</span>
          <button type="button" className="purchase-button purchase-button-secondary" onClick={onBackToOrders}>Back to Kitchen Orders</button>
        </div>
      </header>

      {error && <div className="purchase-alert purchase-alert-error" role="alert">{error}</div>}
      {notice && <div className="purchase-alert purchase-alert-success" role="status">{notice}</div>}

      <div className="purchase-module-tabs" role="tablist" aria-label="Purchase management sections">
        <button
          type="button"
          role="tab"
          aria-selected={activePanel === "purchase"}
          className={activePanel === "purchase" ? "active" : ""}
          onClick={() => setActivePanel("purchase")}
        >
          Manage purchases
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activePanel === "leftover"}
          className={activePanel === "leftover" ? "active" : ""}
          onClick={() => setActivePanel("leftover")}
        >
          Leftover inventory
        </button>
      </div>

      {activePanel === "leftover" ? (
        <LeftoverInventoryPanel
          accessToken={accessToken}
          onSignOut={onSignOut}
          categories={categories}
          ingredients={ingredients}
          signedInEmail={signedInEmail}
        />
      ) : (
        <>
      <section className="purchase-entry-card">
        <div className="purchase-section-heading">
          <div>
            <p className="purchase-eyebrow">NEW PURCHASE</p>
            <h2>Category sheets</h2>
            <p className="purchase-muted">You can purchase from just one category. Only sheets with entered ingredient rows are included; untouched categories are ignored. Each included category keeps its own date, supplier and optional invoice number.</p>
          </div>
          <button type="button" className="purchase-button purchase-button-primary" onClick={() => void openReview()} disabled={savingDraft || submitting}>
            Review &amp; Submit
          </button>
        </div>

        <div className="purchase-recorder-row">
          <label>
            <span>Person recording this purchase</span>
            <input
              value={draft.recordedByName}
              maxLength={120}
              placeholder="Enter staff member name"
              onChange={(event) => setDraft((current) => ({ ...current, recordedByName: event.target.value }))}
            />
          </label>
        </div>

        <div className="purchase-tabs" role="tablist" aria-label="Purchasing categories">
          {categories.map((category) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeCategoryId === category.id}
              className={activeCategoryId === category.id ? "active" : ""}
              key={category.id}
              onClick={() => { setActiveCategoryId(category.id); setPasteError(""); }}
            >
              {category.name}
            </button>
          ))}
        </div>

        {activeSheet && activeCategory ? (
          <div className="purchase-sheet">
            <div className="purchase-sheet-meta">
              <label>
                <span>Purchase date</span>
                <input type="date" value={activeSheet.purchaseDate} onChange={(event) => updateActiveSheet((sheet) => ({ ...sheet, purchaseDate: event.target.value }))} />
              </label>
              <label>
                <span>Supplier</span>
                <input value={activeSheet.supplierName} maxLength={160} placeholder="Supplier name" onChange={(event) => updateActiveSheet((sheet) => ({ ...sheet, supplierName: event.target.value }))} />
              </label>
              <label>
                <span>Invoice number <small>(optional)</small></span>
                <input value={activeSheet.invoiceNumber} maxLength={120} placeholder="Invoice / bill number" onChange={(event) => updateActiveSheet((sheet) => ({ ...sheet, invoiceNumber: event.target.value }))} />
              </label>
            </div>

            <div className="purchase-lines-heading">
              <h3>{activeCategory.name} items</h3>
              <span>{activeIngredients.length} active ingredients assigned</span>
            </div>

            {activeIngredients.length === 0 && (
              <div className="purchase-alert purchase-alert-info">
                No active ingredients are assigned to {activeCategory.name} yet. Assign an inventory purchasing category in Ingredients before recording its purchases.
              </div>
            )}

            <div className="purchase-table-wrap">
              <table className="purchase-line-table">
                <thead>
                  <tr>
                    <th>Ingredient</th>
                    <th>Quantity</th>
                    <th>Purchase unit</th>
                    <th>Total item amount (₹)</th>
                    <th aria-label="Remove row"></th>
                  </tr>
                </thead>
                <tbody>
                  {activeSheet.lines.map((line, index) => (
                    <tr key={line.rowKey}>
                      <td data-label="Ingredient">
                        <IngredientPicker
                          value={line.ingredientInput}
                          options={activeIngredients}
                          selectedIngredientId={line.ingredientId}
                          onChange={(value) => updateLine(line.rowKey, { ingredientId: "", ingredientInput: value, purchaseUnitId: "" })}
                          onSelect={(ingredient) => selectIngredient(line.rowKey, ingredient)}
                        />
                      </td>
                      <td data-label="Quantity">
                        <input className="purchase-number-input" inputMode="decimal" value={line.quantity} placeholder="0.000" onChange={(event) => updateLine(line.rowKey, { quantity: event.target.value })} onKeyDown={handleRowEnter} aria-label={`Quantity row ${index + 1}`} />
                      </td>
                      <td data-label="Purchase unit">
                        <select
                          value={line.purchaseUnitId}
                          onChange={(event) => updateLine(line.rowKey, { purchaseUnitId: event.target.value })}
                          onKeyDown={handleRowEnter}
                          aria-label={`Purchase unit row ${index + 1}`}
                          disabled={!ingredients.some((item) => item.id === line.ingredientId)}
                        >
                          <option value="">Select unit</option>
                          {purchaseUnitsFor(ingredients.find((item) => item.id === line.ingredientId) ?? null, units).map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.symbol}) · {unit.code}</option>)}
                        </select>
                      </td>
                      <td data-label="Total item amount">
                        <input className="purchase-number-input" inputMode="decimal" value={line.itemAmount} placeholder="0.00" onChange={(event) => updateLine(line.rowKey, { itemAmount: event.target.value })} onKeyDown={handleRowEnter} aria-label={`Total item amount row ${index + 1}`} />
                      </td>
                      <td className="purchase-row-action">
                        <button type="button" className="purchase-remove-button" onClick={() => removeLine(line.rowKey)} aria-label={`Remove row ${index + 1}`}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="purchase-row-controls">
              <button type="button" className="purchase-button purchase-button-secondary" onClick={addLine}>+ Add ingredient row</button>
            </div>

            <details className="purchase-paste-panel">
              <summary>Bulk paste rows from Excel</summary>
              <p>Paste one row per line with tab-separated columns: <strong>Ingredient name/code · Quantity · Unit code (optional) · Total item amount</strong>. Leave unit code blank to use the ingredient’s default purchase unit, or base unit. Ingredient and unit must match the catalogue.</p>
              <textarea value={pasteText} onChange={(event) => setPasteText(event.target.value)} rows={4} placeholder={"Paneer\t5\tKG\t1500.00\nTomato\t2\tKG\t80.00"} />
              {pasteError && <p className="purchase-inline-error">{pasteError}</p>}
              <button type="button" className="purchase-button purchase-button-secondary" onClick={applyBulkPaste}>Add pasted rows</button>
            </details>
          </div>
        ) : (
          <div className="purchase-empty">No active inventory purchasing categories are available.</div>
        )}
      </section>

      <section className="purchase-history-card">
        <div className="purchase-section-heading">
          <div>
            <p className="purchase-eyebrow">RECORDS</p>
            <h2>Purchase history</h2>
            <p className="purchase-muted">Search submitted transactions, open the original category sheets or void a transaction with an audit reason.</p>
          </div>
          <button type="button" className="purchase-button purchase-button-secondary" onClick={() => void loadHistory(1)} disabled={historyLoading}>Refresh history</button>
        </div>

        <div className="purchase-filters">
          <label><span>From date</span><input type="date" value={historyFilters.from} onChange={(event) => updateFilter("from", event.target.value)} /></label>
          <label><span>To date</span><input type="date" value={historyFilters.to} onChange={(event) => updateFilter("to", event.target.value)} /></label>
          <label><span>Category</span>
            <select value={historyFilters.categoryId} onChange={(event) => updateFilter("categoryId", event.target.value)}>
              <option value="">All categories</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label><span>Supplier</span><input value={historyFilters.supplier} onChange={(event) => updateFilter("supplier", event.target.value)} placeholder="Supplier contains…" /></label>
          <label><span>Ingredient</span><input value={historyFilters.ingredient} onChange={(event) => updateFilter("ingredient", event.target.value)} placeholder="Name or code contains…" /></label>
          <label><span>Invoice number</span><input value={historyFilters.invoice} onChange={(event) => updateFilter("invoice", event.target.value)} placeholder="Invoice contains…" /></label>
          <label><span>Recorded by</span><input value={historyFilters.recordedBy} onChange={(event) => updateFilter("recordedBy", event.target.value)} placeholder="Name or email contains…" /></label>
          <label><span>Purchase reference</span><input value={historyFilters.reference} onChange={(event) => updateFilter("reference", event.target.value)} placeholder="PUR-…" /></label>
          <label><span>Minimum amount (₹)</span><input inputMode="decimal" value={historyFilters.minAmount} onChange={(event) => updateFilter("minAmount", event.target.value)} placeholder="0.00" /></label>
          <label><span>Maximum amount (₹)</span><input inputMode="decimal" value={historyFilters.maxAmount} onChange={(event) => updateFilter("maxAmount", event.target.value)} placeholder="0.00" /></label>
          <label><span>Sort by</span>
            <select value={historyFilters.sortBy} onChange={(event) => updateFilter("sortBy", event.target.value as HistoryFilters["sortBy"])}>
              <option value="createdAt">Recorded date</option>
              <option value="reference">Purchase reference</option>
              <option value="totalAmount">Total amount</option>
            </select>
          </label>
          <label><span>Direction</span>
            <select value={historyFilters.sortOrder} onChange={(event) => updateFilter("sortOrder", event.target.value as HistoryFilters["sortOrder"])}>
              <option value="desc">Newest / highest first</option>
              <option value="asc">Oldest / lowest first</option>
            </select>
          </label>
        </div>
        <div className="purchase-filter-actions">
          <button type="button" className="purchase-button purchase-button-primary" onClick={() => void loadHistory(1)} disabled={historyLoading}>Apply filters</button>
          <button type="button" className="purchase-button purchase-button-secondary" onClick={() => { setHistoryFilters(initialFilters); void loadHistory(1, initialFilters); }} disabled={historyLoading}>Clear filters</button>
          <span>{historyData ? `${historyData.total} transaction${historyData.total === 1 ? "" : "s"} found` : ""}</span>
        </div>

        <div className="purchase-history-table-wrap">
          <table className="purchase-history-table">
            <thead><tr><th>Reference</th><th>Purchase date(s)</th><th>Category sheet(s)</th><th>Supplier(s)</th><th>Total amount</th><th>Recorded by</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {historyLoading ? (
                <tr><td colSpan={8} className="purchase-empty-cell">Loading purchase history…</td></tr>
              ) : !historyData?.items.length ? (
                <tr><td colSpan={8} className="purchase-empty-cell">No purchase transactions found.</td></tr>
              ) : historyData.items.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.reference}</strong><small>{new Date(item.createdAt).toLocaleString("en-IN")}</small></td>
                  <td>{item.sheets.map((sheet) => dateLabel(sheet.purchaseDate)).join(", ")}</td>
                  <td>{item.sheets.map((sheet) => sheet.inventoryCategoryNameSnapshot).join(", ")}</td>
                  <td>{item.sheets.map((sheet) => sheet.supplierName).join(", ")}</td>
                  <td className="purchase-amount-cell">{formatAmount(item.totalAmount)}</td>
                  <td><strong>{item.recordedByName}</strong><small>{item.recordedByEmail}</small></td>
                  <td><span className={`purchase-status ${item.voidedAt ? "is-voided" : "is-posted"}`}>{item.voidedAt ? "Voided" : "Posted"}</span></td>
                  <td><button type="button" className="purchase-text-button" onClick={() => void openDetail(item.id)}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {historyData && historyData.totalPages > 1 && (
          <div className="purchase-pagination">
            <button type="button" className="purchase-button purchase-button-secondary" disabled={historyData.page <= 1 || historyLoading} onClick={() => void loadHistory(historyData.page - 1)}>Previous</button>
            <span>Page {historyData.page} of {historyData.totalPages}</span>
            <button type="button" className="purchase-button purchase-button-secondary" disabled={historyData.page >= historyData.totalPages || historyLoading} onClick={() => void loadHistory(historyData.page + 1)}>Next</button>
          </div>
        )}
      </section>

      {reviewOpen && (
        <div className="purchase-modal-backdrop" role="presentation">
          <section className="purchase-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-review-title">
            <div className="purchase-modal-header">
              <div><p className="purchase-eyebrow">FINAL CHECK</p><h2 id="purchase-review-title">Review purchase sheets</h2></div>
              <button type="button" className="purchase-modal-close" onClick={() => setReviewOpen(false)} aria-label="Close review">×</button>
            </div>
            {review.errors.length > 0 ? (
              <div className="purchase-alert purchase-alert-error"><strong>Please correct these items:</strong><ul>{review.errors.map((item) => <li key={item}>{item}</li>)}</ul></div>
            ) : (
              <>
                <p className="purchase-muted">Recorded by <strong>{draft.recordedByName}</strong>. These category sheets will be saved together as one transaction. The item amount is the full amount for that row, not a per-unit rate.</p>
                {review.completed.map(({ sheet, category, rows }) => (
                  <div className="purchase-review-sheet" key={category.id}>
                    <h3>{category.name}</h3>
                    <p>{dateLabel(sheet.purchaseDate)} · {sheet.supplierName}{sheet.invoiceNumber ? ` · Invoice ${sheet.invoiceNumber}` : ""}</p>
                    <ul>{rows.map((line) => {
                      const ingredient = ingredients.find((item) => item.id === line.ingredientId);
                      const unit = units.find((item) => item.id === line.purchaseUnitId);
                      return <li key={line.rowKey}><span>{ingredient?.name} · {line.quantity} {unit?.symbol}</span><strong>{formatAmount(line.itemAmount)}</strong></li>;
                    })}</ul>
                  </div>
                ))}
                <div className="purchase-review-total">
                  <span>Transaction total</span>
                  <strong>{formatCents(review.completed.reduce((sum, item) => sum + item.rows.reduce((rowSum, line) => rowSum + amountCents(line.itemAmount), 0n), 0n))}</strong>
                </div>
              </>
            )}
            <div className="purchase-modal-actions">
              <button type="button" className="purchase-button purchase-button-secondary" onClick={() => setReviewOpen(false)} disabled={submitting}>Back to draft</button>
              <button type="button" className="purchase-button purchase-button-primary" onClick={() => void confirmSubmit()} disabled={submitting || review.errors.length > 0}>
                {submitting ? "Submitting…" : "Confirm & Submit"}
              </button>
            </div>
          </section>
        </div>
      )}

      {(detail || detailLoading) && (
        <div className="purchase-modal-backdrop" role="presentation">
          <section className="purchase-modal purchase-detail-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-detail-title">
            <div className="purchase-modal-header">
              <div><p className="purchase-eyebrow">PURCHASE TRANSACTION</p><h2 id="purchase-detail-title">{detail?.reference ?? "Loading…"}</h2></div>
              <button type="button" className="purchase-modal-close" onClick={() => setDetail(null)} aria-label="Close details">×</button>
            </div>
            {detailLoading || !detail ? <p>Loading original transaction…</p> : (
              <>
                <div className="purchase-detail-meta">
                  <span>Recorded by <strong>{detail.recordedByName}</strong><small> {detail.recordedByEmail}</small></span>
                  <span>Saved <strong>{new Date(detail.createdAt).toLocaleString("en-IN")}</strong></span>
                  <span>Total <strong>{formatAmount(detail.totalAmount)}</strong></span>
                  <span>Status <strong>{detail.voidedAt ? "Voided" : "Posted"}</strong></span>
                </div>
                {detail.sheets.map((sheet) => (
                  <div className="purchase-review-sheet" key={sheet.id}>
                    <h3>{sheet.inventoryCategoryNameSnapshot}</h3>
                    <p>{dateLabel(sheet.purchaseDate)} · {sheet.supplierName}{sheet.invoiceNumber ? ` · Invoice ${sheet.invoiceNumber}` : ""}</p>
                    <ul>{sheet.lines.map((line) => (
                      <li key={line.id}>
                        <span>{line.ingredientNameSnapshot} ({line.ingredientCodeSnapshot}) · {line.quantity} {line.purchaseUnitSymbolSnapshot} ({line.purchaseUnitNameSnapshot})</span>
                        <strong>{formatAmount(line.itemAmount)}</strong>
                      </li>
                    ))}</ul>
                  </div>
                ))}
                {detail.voidedAt ? (
                  <div className="purchase-alert purchase-alert-error">
                    Voided by {detail.voidedByEmail} on {new Date(detail.voidedAt).toLocaleString("en-IN")}. Reason: {detail.voidReason}
                  </div>
                ) : (
                  <form className="purchase-void-form" onSubmit={(event) => void voidTransaction(event)}>
                    <label><span>Void reason (required)</span><textarea value={voidReason} onChange={(event) => setVoidReason(event.target.value)} rows={2} maxLength={1000} placeholder="Explain why this transaction is being voided." required /></label>
                    <button type="submit" className="purchase-button purchase-button-danger" disabled={voiding || !voidReason.trim()}>{voiding ? "Voiding…" : "Void transaction"}</button>
                  </form>
                )}
              </>
            )}
          </section>
        </div>
      )}
        </>
      )}
    </main>
  );
}