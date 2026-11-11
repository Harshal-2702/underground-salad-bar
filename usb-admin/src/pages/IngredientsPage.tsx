import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { API_URL } from "../config";
import "../ingredients.css";

type Unit = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  dimension: "MASS" | "VOLUME" | "COUNT" | "PORTION" | "PACKAGE";
  factorToCanonical: string | null;
  isActive: boolean;
};

type Category = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

type Allergen = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};

type Ingredient = {
  id: string;
  code: string;
  sku: string | null;
  name: string;
  description: string | null;
  categoryId: string | null;
  baseUnitId: string;
  defaultPurchaseUnitId: string | null;
  isStockTracked: boolean;
  isActive: boolean;
  sortOrder: number;
  category: Category | null;
  baseUnit: Unit;
  defaultPurchaseUnit: Unit | null;
  unitConversions: Array<{
    ingredientId: string;
    unitId: string;
    quantityInBaseUnit: string;
    isApproximate: boolean;
    notes: string | null;
    unit: Unit;
  }>;
  allergens: Array<{
    ingredientId: string;
    allergenId: string;
    presence: "CONTAINS" | "MAY_CONTAIN" | "CROSS_CONTACT_RISK";
    notes: string | null;
    allergen: Allergen;
  }>;
};

type IngredientForm = {
  code: string;
  name: string;
  description: string;
  categoryId: string;
  baseUnitId: string;
  defaultPurchaseUnitId: string;
  conversionQuantity: string;
  isStockTracked: boolean;
  sortOrder: string;
};

type Props = {
  accessToken: string;
  signedInEmail: string;
  onBackToOrders: () => void;
  onSignOut: () => Promise<void>;
};

const blankForm: IngredientForm = {
  code: "",
  name: "",
  description: "",
  categoryId: "",
  baseUnitId: "",
  defaultPurchaseUnitId: "",
  conversionQuantity: "",
  isStockTracked: true,
  sortOrder: "0",
};

const presenceOptions = [
  { value: "CONTAINS", label: "Contains" },
  { value: "MAY_CONTAIN", label: "May contain" },
  { value: "CROSS_CONTACT_RISK", label: "Cross-contact risk" },
] as const;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function requiresSpecificConversion(base?: Unit, target?: Unit): boolean {
  if (!base || !target || base.id === target.id) return false;

  const globallyConvertible = ["MASS", "VOLUME", "COUNT"].includes(base.dimension);

  return !(
    globallyConvertible &&
    base.dimension === target.dimension &&
    base.factorToCanonical !== null &&
    target.factorToCanonical !== null
  );
}

async function apiRequest<T>(
  path: string,
  accessToken: string,
  onSignOut: () => Promise<void>,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  if (init.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  const raw = await response.text();
  let payload: unknown = null;

  if (raw) {
    try {
      payload = JSON.parse(raw) as unknown;
    } catch {
      payload = null;
    }
  }

  if (response.status === 401) {
    await onSignOut();
    throw new Error("Your session expired. Please sign in again.");
  }

  if (response.status === 403) {
    throw new Error("This account is not authorised to manage the ingredient catalogue.");
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Request failed (${response.status}).`;

    throw new Error(message);
  }

  return payload as T;
}

export default function IngredientsPage({
  accessToken,
  signedInEmail,
  onBackToOrders,
  onSignOut,
}: Props) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [allergens, setAllergens] = useState<Allergen[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<IngredientForm>(blankForm);

  const [conversionUnitId, setConversionUnitId] = useState("");
  const [conversionQuantity, setConversionQuantity] = useState("");
  const [conversionNotes, setConversionNotes] = useState("");

  const [allergenId, setAllergenId] = useState("");
  const [allergenPresence, setAllergenPresence] =
    useState<(typeof presenceOptions)[number]["value"]>("CONTAINS");
  const [allergenNotes, setAllergenNotes] = useState("");

  const [newAllergenCode, setNewAllergenCode] = useState("");
  const [newAllergenName, setNewAllergenName] = useState("");
  const [showNewAllergen, setShowNewAllergen] = useState(false);

  const loadCatalogue = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [ingredientRows, categoryRows, unitRows, allergenRows] =
        await Promise.all([
          apiRequest<Ingredient[]>(
            "/ingredients?includeInactive=true",
            accessToken,
            onSignOut,
          ),
          apiRequest<Category[]>("/ingredient-categories", accessToken, onSignOut),
          apiRequest<Unit[]>("/units", accessToken, onSignOut),
          apiRequest<Allergen[]>("/allergens", accessToken, onSignOut),
        ]);

      setIngredients(ingredientRows);
      setCategories(categoryRows);
      setUnits(unitRows);
      setAllergens(allergenRows);

      if (
        selectedId &&
        !ingredientRows.some((item) => item.id === selectedId)
      ) {
        setSelectedId(null);
      }
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [accessToken, onSignOut, selectedId]);

  useEffect(() => {
    void loadCatalogue();
  }, [loadCatalogue]);

  const selected = ingredients.find((item) => item.id === selectedId) ?? null;

  const visibleIngredients = useMemo(() => {
    const query = search.trim().toLowerCase();

    return ingredients
      .filter((item) => showArchived || item.isActive)
      .filter(
        (item) =>
          activeCategory === "ALL" || item.categoryId === activeCategory,
      )
      .filter(
        (item) =>
          !query ||
          item.name.toLowerCase().includes(query) ||
          item.code.toLowerCase().includes(query) ||
          (item.sku ?? "").toLowerCase().includes(query),
      )
      .sort(
        (a, b) =>
          (a.category?.sortOrder ?? 99) - (b.category?.sortOrder ?? 99) ||
          a.sortOrder - b.sortOrder ||
          a.name.localeCompare(b.name),
      );
  }, [ingredients, search, activeCategory, showArchived]);

  const activeCount = ingredients.filter((item) => item.isActive).length;
  const archivedCount = ingredients.length - activeCount;
  const stockTrackedCount = ingredients.filter(
    (item) => item.isActive && item.isStockTracked,
  ).length;

  const conversionCandidates = selected
    ? units.filter((unit) =>
        requiresSpecificConversion(selected.baseUnit, unit),
      )
    : [];

  const unlinkedAllergens = selected
    ? allergens.filter(
        (item) =>
          item.isActive &&
          !selected.allergens.some((link) => link.allergenId === item.id),
      )
    : [];

  function openCreate() {
    const defaultBase = units.find((unit) => unit.code === "G") ?? units[0];

    setEditingId(null);
    setForm({
      ...blankForm,
      baseUnitId: defaultBase?.id ?? "",
      sortOrder: "0",
    });
    setError("");
    setFormOpen(true);
  }

  function openEdit(item: Ingredient) {
    setEditingId(item.id);
    setForm({
      code: item.code,
      name: item.name,
      description: item.description ?? "",
      categoryId: item.categoryId ?? "",
      baseUnitId: item.baseUnitId,
      defaultPurchaseUnitId: item.defaultPurchaseUnitId ?? "",
      conversionQuantity: "",
      isStockTracked: item.isStockTracked,
      sortOrder: String(item.sortOrder),
    });
    setError("");
    setFormOpen(true);
  }

  async function saveIngredient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload: Record<string, unknown> = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        categoryId: form.categoryId || null,
        isStockTracked: form.isStockTracked,
        sortOrder: Number(form.sortOrder || 0),
      };

      let result: Ingredient;

      if (editingId) {
        result = await apiRequest<Ingredient>(
          `/ingredients/${editingId}`,
          accessToken,
          onSignOut,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        );
      } else {
        const base = units.find((unit) => unit.id === form.baseUnitId);
        const purchase = units.find(
          (unit) => unit.id === form.defaultPurchaseUnitId,
        );

        if (!base) throw new Error("Select a valid base unit.");

        const needsConversion = requiresSpecificConversion(base, purchase);

        if (needsConversion && !form.conversionQuantity.trim()) {
          throw new Error(
            "Enter how much of the purchase unit equals one ingredient base unit quantity.",
          );
        }

        payload.baseUnitId = form.baseUnitId;
        payload.defaultPurchaseUnitId = form.defaultPurchaseUnitId || null;

        if (needsConversion && purchase) {
          payload.conversions = [
            {
              unitId: purchase.id,
              quantityInBaseUnit: form.conversionQuantity.trim(),
              notes: "Initial purchase-unit conversion",
            },
          ];
        }

        result = await apiRequest<Ingredient>(
          "/ingredients",
          accessToken,
          onSignOut,
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
        );
      }

      setFormOpen(false);
      setSelectedId(result.id);
      setNotice(editingId ? "Ingredient updated." : "Ingredient created.");
      await loadCatalogue();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function archiveIngredient(item: Ingredient) {
    if (!window.confirm(`Archive ${item.name}? It will remain in historical records.`)) {
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await apiRequest(
        `/ingredients/${item.id}/archive`,
        accessToken,
        onSignOut,
        { method: "PATCH" },
      );

      if (selectedId === item.id) setSelectedId(null);
      setNotice(`${item.name} archived.`);
      await loadCatalogue();
    } catch (archiveError) {
      setError(errorMessage(archiveError));
    } finally {
      setSaving(false);
    }
  }

  async function saveConversion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selected) return;

    const unitId = conversionUnitId || conversionCandidates[0]?.id;
    if (!unitId) {
      setError("No ingredient-specific conversion units are available.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await apiRequest(
        `/ingredients/${selected.id}/conversions/${unitId}`,
        accessToken,
        onSignOut,
        {
          method: "PUT",
          body: JSON.stringify({
            quantityInBaseUnit: conversionQuantity.trim(),
            notes: conversionNotes.trim() || null,
          }),
        },
      );

      setConversionQuantity("");
      setConversionNotes("");
      setNotice("Conversion saved.");
      await loadCatalogue();
    } catch (conversionError) {
      setError(errorMessage(conversionError));
    } finally {
      setSaving(false);
    }
  }

  async function removeConversion(unitId: string) {
    if (!selected) return;

    if (!window.confirm("Remove this ingredient-specific conversion?")) return;

    setSaving(true);
    setError("");

    try {
      await apiRequest(
        `/ingredients/${selected.id}/conversions/${unitId}`,
        accessToken,
        onSignOut,
        { method: "DELETE" },
      );

      setNotice("Conversion removed.");
      await loadCatalogue();
    } catch (conversionError) {
      setError(errorMessage(conversionError));
    } finally {
      setSaving(false);
    }
  }

  async function setDefaultPurchaseUnit(unitId: string | null) {
    if (!selected) return;

    setSaving(true);
    setError("");

    try {
      await apiRequest(
        `/ingredients/${selected.id}`,
        accessToken,
        onSignOut,
        {
          method: "PATCH",
          body: JSON.stringify({ defaultPurchaseUnitId: unitId }),
        },
      );

      setNotice("Default purchase unit updated.");
      await loadCatalogue();
    } catch (purchaseError) {
      setError(errorMessage(purchaseError));
    } finally {
      setSaving(false);
    }
  }

  async function addAllergen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !allergenId) return;

    setSaving(true);
    setError("");

    try {
      await apiRequest(
        `/ingredients/${selected.id}/allergens/${allergenId}`,
        accessToken,
        onSignOut,
        {
          method: "PUT",
          body: JSON.stringify({
            presence: allergenPresence,
            notes: allergenNotes.trim() || null,
          }),
        },
      );

      setAllergenNotes("");
      setNotice("Allergen association saved.");
      await loadCatalogue();
    } catch (allergenError) {
      setError(errorMessage(allergenError));
    } finally {
      setSaving(false);
    }
  }

  async function removeAllergen(linkedAllergenId: string) {
    if (!selected) return;
    if (!window.confirm("Remove this allergen association?")) return;

    setSaving(true);
    setError("");

    try {
      await apiRequest(
        `/ingredients/${selected.id}/allergens/${linkedAllergenId}`,
        accessToken,
        onSignOut,
        { method: "DELETE" },
      );

      setNotice("Allergen association removed.");
      await loadCatalogue();
    } catch (allergenError) {
      setError(errorMessage(allergenError));
    } finally {
      setSaving(false);
    }
  }

  async function createAllergen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selected) return;

    setSaving(true);
    setError("");

    try {
      const created = await apiRequest<Allergen>(
        "/allergens",
        accessToken,
        onSignOut,
        {
          method: "POST",
          body: JSON.stringify({
            code: newAllergenCode.trim(),
            name: newAllergenName.trim(),
          }),
        },
      );

      await apiRequest(
        `/ingredients/${selected.id}/allergens/${created.id}`,
        accessToken,
        onSignOut,
        {
          method: "PUT",
          body: JSON.stringify({ presence: allergenPresence }),
        },
      );

      setNewAllergenCode("");
      setNewAllergenName("");
      setShowNewAllergen(false);
      setNotice("Allergen created and linked.");
      await loadCatalogue();
    } catch (allergenError) {
      setError(errorMessage(allergenError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="catalogue-shell">
      <header className="catalogue-header">
        <div className="catalogue-brand">
          <div className="catalogue-mark">U</div>
          <div>
            <div className="catalogue-eyebrow">UNDERGROUND · KITCHEN OS</div>
            <div className="catalogue-header-title">Ingredient catalogue</div>
            <div className="catalogue-signed-in">{signedInEmail}</div>
          </div>
        </div>

        <div className="catalogue-header-actions">
          <button className="catalogue-button catalogue-button-quiet" onClick={onBackToOrders}>
            ← Orders
          </button>
          <button
            className="catalogue-button catalogue-button-quiet"
            onClick={() => void onSignOut()}
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="catalogue-intro">
        <div>
          <div className="catalogue-eyebrow">KITCHEN OPERATIONS / MASTER DATA</div>
          <h1>Ingredients</h1>
          <p>Manage your kitchen ingredients, measurement units and allergen information.</p>
        </div>

        <button className="catalogue-button catalogue-button-primary" onClick={openCreate}>
          + Add ingredient
        </button>
      </section>

      <section className="catalogue-stats">
        <div className="catalogue-stat">
          <span>Active ingredients</span>
          <strong>{activeCount}</strong>
        </div>
        <div className="catalogue-stat">
          <span>Stock tracked</span>
          <strong>{stockTrackedCount}</strong>
        </div>
        <div className="catalogue-stat">
          <span>Archived</span>
          <strong>{archivedCount}</strong>
        </div>
        <div className="catalogue-stat">
          <span>Categories</span>
          <strong>{categories.length}</strong>
        </div>
      </section>

      {error && <div className="catalogue-message catalogue-message-error" role="alert">{error}</div>}
      {notice && <div className="catalogue-message catalogue-message-success" role="status">{notice}</div>}

      <section className="catalogue-workspace">
        <div className="catalogue-list-panel">
          <div className="catalogue-toolbar">
            <label className="catalogue-search">
              <span>⌕</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search ingredient or code"
                aria-label="Search ingredients"
              />
            </label>

            <label className="catalogue-archived-toggle">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
              />
              Show archived
            </label>
          </div>

          <div className="catalogue-category-filters">
            <button
              className={activeCategory === "ALL" ? "active" : ""}
              onClick={() => setActiveCategory("ALL")}
            >
              All ingredients
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                className={activeCategory === category.id ? "active" : ""}
                onClick={() => setActiveCategory(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>

          <div className="catalogue-list-heading">
            <span>{visibleIngredients.length} ingredients</span>
            <span>Name / code</span>
            <span>Category</span>
            <span>Base unit</span>
            <span>Status</span>
            <span>Actions</span>
          </div>

          {loading ? (
            <div className="catalogue-empty">Loading ingredient catalogue…</div>
          ) : visibleIngredients.length === 0 ? (
            <div className="catalogue-empty">
              No ingredients found. Try another search or category.
            </div>
          ) : (
            <div className="catalogue-rows">
              {visibleIngredients.map((item) => (
                <article
                  key={item.id}
                  className={`catalogue-row ${selectedId === item.id ? "selected" : ""}`}
                >
                  <button
                    className="catalogue-row-main"
                    onClick={() => setSelectedId(item.id)}
                  >
                    <span className="catalogue-mobile-label">Ingredient</span>
                    <strong>{item.name}</strong>
                    <small>{item.code}</small>
                  </button>

                  <div className="catalogue-row-category">
                    <span className="catalogue-mobile-label">Category</span>
                    {item.category?.name ?? "Uncategorised"}
                  </div>

                  <div className="catalogue-row-unit">
                    <span className="catalogue-mobile-label">Base unit</span>
                    <strong>{item.baseUnit.symbol}</strong>
                    <small>{item.baseUnit.dimension}</small>
                  </div>

                  <div className="catalogue-row-status">
                    <span className={`catalogue-status ${item.isActive ? "is-active" : "is-archived"}`}>
                      {item.isActive ? "Active" : "Archived"}
                    </span>
                  </div>

                  <div className="catalogue-row-actions">
                    <button
                      className="catalogue-text-button"
                      onClick={() => openEdit(item)}
                      disabled={!item.isActive}
                    >
                      Edit
                    </button>
                    {item.isActive && (
                      <button
                        className="catalogue-text-button catalogue-danger-text"
                        onClick={() => void archiveIngredient(item)}
                        disabled={saving}
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="catalogue-detail-panel">
          {!selected ? (
            <div className="catalogue-detail-empty">
              <div className="catalogue-detail-icon">↗</div>
              <h2>Ingredient details</h2>
              <p>Select an ingredient to manage its conversions and allergens.</p>
            </div>
          ) : (
            <>
              <div className="catalogue-detail-heading">
                <div>
                  <div className="catalogue-eyebrow">INGREDIENT DETAILS</div>
                  <h2>{selected.name}</h2>
                  <small>{selected.code}</small>
                </div>
                <span className={`catalogue-status ${selected.isActive ? "is-active" : "is-archived"}`}>
                  {selected.isActive ? "Active" : "Archived"}
                </span>
              </div>

              <div className="catalogue-detail-facts">
                <div>
                  <span>Category</span>
                  <strong>{selected.category?.name ?? "Uncategorised"}</strong>
                </div>
                <div>
                  <span>Base unit</span>
                  <strong>{selected.baseUnit.name} ({selected.baseUnit.symbol})</strong>
                </div>
                <div>
                  <span>Default purchase unit</span>
                  <strong>{selected.defaultPurchaseUnit?.name ?? "Not assigned"}</strong>
                </div>
                <div>
                  <span>Stock tracking</span>
                  <strong>{selected.isStockTracked ? "Enabled" : "Disabled"}</strong>
                </div>
              </div>

              <section className="catalogue-detail-section">
                <div className="catalogue-section-title">
                  <div>
                    <h3>Unit conversions</h3>
                    <p>Ingredient-specific scoop and pack measurements.</p>
                  </div>
                </div>

                {selected.unitConversions.length === 0 ? (
                  <p className="catalogue-muted">No ingredient-specific conversions assigned.</p>
                ) : (
                  <div className="catalogue-linked-list">
                    {selected.unitConversions.map((conversion) => (
                      <div className="catalogue-linked-item" key={conversion.unitId}>
                        <div>
                          <strong>{conversion.unit.name}</strong>
                          <small>
                            1 {conversion.unit.symbol} = {conversion.quantityInBaseUnit} {selected.baseUnit.symbol}
                            {conversion.isApproximate ? " · Approximate" : ""}
                          </small>
                          {conversion.notes && <small>{conversion.notes}</small>}
                        </div>
                        <div className="catalogue-linked-actions">
                          {selected.defaultPurchaseUnitId !== conversion.unitId && selected.isActive && (
                            <button
                              className="catalogue-text-button"
                              onClick={() => void setDefaultPurchaseUnit(conversion.unitId)}
                              disabled={saving}
                            >
                              Set default
                            </button>
                          )}
                          {selected.isActive && (
                            <button
                              className="catalogue-text-button catalogue-danger-text"
                              onClick={() => void removeConversion(conversion.unitId)}
                              disabled={saving || selected.defaultPurchaseUnitId === conversion.unitId}
                              title={selected.defaultPurchaseUnitId === conversion.unitId ? "Change the default purchase unit first" : "Remove conversion"}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selected.defaultPurchaseUnit && selected.defaultPurchaseUnitId && (
                  <button
                    className="catalogue-text-button catalogue-default-clear"
                    onClick={() => void setDefaultPurchaseUnit(null)}
                    disabled={saving || !selected.isActive}
                  >
                    Clear default purchase unit
                  </button>
                )}

                {selected.isActive && conversionCandidates.length > 0 && (
                  <form className="catalogue-inline-form" onSubmit={(event) => void saveConversion(event)}>
                    <label>
                      Conversion unit
                      <select
                        value={conversionUnitId || conversionCandidates[0]?.id || ""}
                        onChange={(event) => setConversionUnitId(event.target.value)}
                      >
                        {conversionCandidates.map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {unit.name} ({unit.symbol}) · {unit.dimension}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Quantity in {selected.baseUnit.symbol}
                      <input
                        required
                        inputMode="decimal"
                        pattern="[0-9]+([.][0-9]{1,6})?"
                        value={conversionQuantity}
                        onChange={(event) => setConversionQuantity(event.target.value)}
                        placeholder="e.g. 70"
                      />
                    </label>
                    <label>
                      Notes
                      <input
                        value={conversionNotes}
                        onChange={(event) => setConversionNotes(event.target.value)}
                        placeholder="Optional measurement note"
                      />
                    </label>
                    <button className="catalogue-button catalogue-button-secondary" disabled={saving}>
                      Save conversion
                    </button>
                  </form>
                )}
              </section>

              <section className="catalogue-detail-section">
                <div className="catalogue-section-title">
                  <div>
                    <h3>Allergens</h3>
                    <p>Record declared ingredients and cross-contact risks.</p>
                  </div>
                </div>

                {selected.allergens.length === 0 ? (
                  <p className="catalogue-muted">No allergen associations recorded.</p>
                ) : (
                  <div className="catalogue-linked-list">
                    {selected.allergens.map((link) => (
                      <div className="catalogue-linked-item" key={link.allergenId}>
                        <div>
                          <strong>{link.allergen.name}</strong>
                          <small>{link.presence.replaceAll("_", " ")}</small>
                          {link.notes && <small>{link.notes}</small>}
                        </div>
                        {selected.isActive && (
                          <button
                            className="catalogue-text-button catalogue-danger-text"
                            onClick={() => void removeAllergen(link.allergenId)}
                            disabled={saving}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {selected.isActive && unlinkedAllergens.length > 0 && (
                  <form className="catalogue-inline-form" onSubmit={(event) => void addAllergen(event)}>
                    <label>
                      Allergen
                      <select
                        required
                        value={allergenId}
                        onChange={(event) => setAllergenId(event.target.value)}
                      >
                        <option value="">Select allergen</option>
                        {unlinkedAllergens.map((item) => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Presence
                      <select
                        value={allergenPresence}
                        onChange={(event) => setAllergenPresence(event.target.value as typeof allergenPresence)}
                      >
                        {presenceOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Notes
                      <input
                        value={allergenNotes}
                        onChange={(event) => setAllergenNotes(event.target.value)}
                        placeholder="Optional note"
                      />
                    </label>
                    <button className="catalogue-button catalogue-button-secondary" disabled={saving || !allergenId}>
                      Link allergen
                    </button>
                  </form>
                )}

                {selected.isActive && (
                  <div className="catalogue-create-allergen">
                    {!showNewAllergen ? (
                      <button className="catalogue-text-button" onClick={() => setShowNewAllergen(true)}>
                        + Create a new allergen
                      </button>
                    ) : (
                      <form className="catalogue-inline-form" onSubmit={(event) => void createAllergen(event)}>
                        <label>
                          Allergen code
                          <input
                            required
                            value={newAllergenCode}
                            onChange={(event) => setNewAllergenCode(event.target.value)}
                            placeholder="e.g. PEANUT"
                          />
                        </label>
                        <label>
                          Allergen name
                          <input
                            required
                            value={newAllergenName}
                            onChange={(event) => setNewAllergenName(event.target.value)}
                            placeholder="e.g. Peanut"
                          />
                        </label>
                        <div className="catalogue-form-actions">
                          <button className="catalogue-button catalogue-button-secondary" disabled={saving}>
                            Create and link
                          </button>
                          <button
                            type="button"
                            className="catalogue-text-button"
                            onClick={() => setShowNewAllergen(false)}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </aside>
      </section>

      {formOpen && (
        <div className="catalogue-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setFormOpen(false);
        }}>
          <section
            className="catalogue-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ingredient-form-title"
          >
            <div className="catalogue-modal-heading">
              <div>
                <div className="catalogue-eyebrow">MASTER DATA</div>
                <h2 id="ingredient-form-title">{editingId ? "Edit ingredient" : "Add ingredient"}</h2>
              </div>
              <button className="catalogue-modal-close" onClick={() => setFormOpen(false)} disabled={saving} aria-label="Close">
                ×
              </button>
            </div>

            <form className="catalogue-form" onSubmit={(event) => void saveIngredient(event)}>
              <div className="catalogue-form-grid">
                <label>
                  Ingredient code
                  <input
                    required
                    maxLength={64}
                    value={form.code}
                    onChange={(event) => setForm({ ...form, code: event.target.value })}
                    placeholder="e.g. PANEER"
                  />
                </label>
                <label>
                  Ingredient name
                  <input
                    required
                    maxLength={160}
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="e.g. Paneer"
                  />
                </label>
                <label>
                  Category
                  <select
                    value={form.categoryId}
                    onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
                  >
                    <option value="">Uncategorised</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Display order
                  <input
                    type="number"
                    min="0"
                    max="1000000"
                    value={form.sortOrder}
                    onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
                  />
                </label>
              </div>

              <label>
                Description
                <textarea
                  rows={2}
                  maxLength={10000}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder="Optional ingredient description"
                />
              </label>

              {!editingId ? (
                <>
                  <div className="catalogue-form-grid">
                    <label>
                      Base measurement unit
                      <select
                        required
                        value={form.baseUnitId}
                        onChange={(event) => setForm({ ...form, baseUnitId: event.target.value })}
                      >
                        {units.filter((unit) => ["MASS", "VOLUME", "COUNT"].includes(unit.dimension)).map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {unit.name} ({unit.symbol}) · {unit.dimension}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Default purchase unit
                      <select
                        value={form.defaultPurchaseUnitId}
                        onChange={(event) => setForm({ ...form, defaultPurchaseUnitId: event.target.value, conversionQuantity: "" })}
                      >
                        <option value="">Not assigned</option>
                        {units.map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {unit.name} ({unit.symbol}) · {unit.dimension}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {requiresSpecificConversion(
                    units.find((unit) => unit.id === form.baseUnitId),
                    units.find((unit) => unit.id === form.defaultPurchaseUnitId),
                  ) && (
                    <label>
                      Quantity of purchase unit in base units
                      <input
                        required
                        inputMode="decimal"
                        pattern="[0-9]+([.][0-9]{1,6})?"
                        value={form.conversionQuantity}
                        onChange={(event) => setForm({ ...form, conversionQuantity: event.target.value })}
                        placeholder={`e.g. 70 ${units.find((unit) => unit.id === form.baseUnitId)?.symbol ?? "g"}`}
                      />
                      <small className="catalogue-field-help">
                        Example: enter 70 when one scoop contains 70 grams.
                      </small>
                    </label>
                  )}
                </>
              ) : (
                <div className="catalogue-unit-note">
                  <strong>Measurement units are protected.</strong>
                  <p>
                    Base and purchase units are not changed in this editor. Manage
                    ingredient-specific conversions in the details panel to avoid
                    changing existing measurement assumptions.
                  </p>
                </div>
              )}

              <label className="catalogue-checkbox-label">
                <input
                  type="checkbox"
                  checked={form.isStockTracked}
                  onChange={(event) => setForm({ ...form, isStockTracked: event.target.checked })}
                />
                Track this ingredient in inventory
              </label>

              <div className="catalogue-form-actions">
                <button className="catalogue-button catalogue-button-primary" disabled={saving}>
                  {saving ? "Saving…" : editingId ? "Save changes" : "Create ingredient"}
                </button>
                <button
                  type="button"
                  className="catalogue-button catalogue-button-quiet"
                  onClick={() => setFormOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}