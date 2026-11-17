import { useCallback, useEffect, useMemo, useState } from "react";
import { API_URL } from "../config";

type InventoryCategory = { id: string; code: string; name: string; sortOrder: number; isActive: boolean };
type Ingredient = {
  id: string;
  code: string;
  name: string;
  inventoryCategoryId: string | null;
  baseUnit: { id: string; code: string; name: string; symbol: string; isActive: boolean };
};
type LeftoverLine = {
  id: string;
  inventoryCategoryId: string;
  inventoryCategoryCodeSnapshot: string;
  inventoryCategoryNameSnapshot: string;
  ingredientCodeSnapshot: string;
  ingredientNameSnapshot: string;
  baseUnitCodeSnapshot: string;
  baseUnitNameSnapshot: string;
  baseUnitSymbolSnapshot: string;
  quantity: string;
  sortOrder: number;
};
type LeftoverTransaction = {
  id: string;
  recordedByEmail: string;
  recordedByName: string;
  stocktakeDate: string;
  createdAt: string;
  lines: LeftoverLine[];
};
type HistoryItem = {
  id: string;
  recordedByEmail: string;
  recordedByName: string;
  stocktakeDate: string;
  createdAt: string;
  _count: { lines: number };
  categories: Array<{ id: string; name: string }>;
};
type HistoryResponse = {
  items: HistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
type Props = {
  accessToken: string;
  onSignOut: () => Promise<void>;
  categories: InventoryCategory[];
  ingredients: Ingredient[];
  signedInEmail: string;
};

function indiaDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((value) => value.type === type)?.value ?? "";
  return part("year") + "-" + part("month") + "-" + part("day");
}

function displayDate(value: string): string {
  return value.slice(0, 10);
}

function quantityIsValid(value: string): boolean {
  return /^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(value.trim());
}

async function apiRequest<T>(
  path: string,
  accessToken: string,
  onSignOut: () => Promise<void>,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", "Bearer " + accessToken);
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetch(API_URL + path, { ...init, headers });
  const raw = await response.text();
  let payload: unknown = null;
  if (raw) {
    try { payload = JSON.parse(raw) as unknown; } catch { payload = null; }
  }
  if (response.status === 401) {
    await onSignOut();
    throw new Error("Your session expired. Please sign in again.");
  }
  if (response.status === 403) throw new Error("This account is not authorised to record leftover inventory.");
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "Request failed (" + response.status + ").";
    throw new Error(message);
  }
  return payload as T;
}

export default function LeftoverInventoryPanel({
  accessToken,
  onSignOut,
  categories,
  ingredients,
  signedInEmail,
}: Props) {
  const [recordedByName, setRecordedByName] = useState("");
  const [stocktakeDate, setStocktakeDate] = useState(indiaDateKey());
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? "");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [recordedByFilter, setRecordedByFilter] = useState("");
  const [detail, setDetail] = useState<LeftoverTransaction | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const activeCategory = categories.find((category) => category.id === activeCategoryId) ?? null;
  const activeIngredients = useMemo(
    () => ingredients
      .filter((ingredient) => ingredient.inventoryCategoryId === activeCategoryId && ingredient.baseUnit?.isActive)
      .sort((left, right) => left.name.localeCompare(right.name)),
    [ingredients, activeCategoryId],
  );
  const enteredCount = Object.values(quantities).filter((value) => value.trim() !== "").length;

  const loadHistory = useCallback(async (page = 1) => {
    setHistoryLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "10" });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (categoryFilter) params.set("categoryId", categoryFilter);
      if (recordedByFilter.trim()) params.set("recordedBy", recordedByFilter.trim());
      const result = await apiRequest<HistoryResponse>(
        "/leftover-inventory/history?" + params.toString(),
        accessToken,
        onSignOut,
      );
      setHistory(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load leftover history.");
    } finally {
      setHistoryLoading(false);
    }
  }, [accessToken, onSignOut, from, to, categoryFilter, recordedByFilter]);

  useEffect(() => {
    void loadHistory(1);
  }, [loadHistory]);

  async function saveStocktake() {
    setError("");
    setNotice("");
    if (!recordedByName.trim()) {
      setError("Enter the name of the person recording this stocktake.");
      return;
    }
    const parsedDate = new Date(stocktakeDate + "T00:00:00.000Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(stocktakeDate) ||
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== stocktakeDate) {
      setError("Choose a valid stocktake date.");
      return;
    }

    const rows = ingredients
      .filter((ingredient) => ingredient.inventoryCategoryId && quantities[ingredient.id]?.trim() !== "")
      .map((ingredient) => ({
        ingredientId: ingredient.id,
        quantity: quantities[ingredient.id].trim(),
      }));

    if (!rows.length) {
      setError("Enter at least one leftover quantity. Leave uncounted ingredients blank; enter 0 when none is left.");
      return;
    }

    const invalid = rows.find((row) => !quantityIsValid(row.quantity));
    if (invalid) {
      const ingredient = ingredients.find((item) => item.id === invalid.ingredientId);
      setError((ingredient?.name ?? "An ingredient") + ": enter a quantity of zero or more, with up to 6 decimal places.");
      return;
    }

    setSaving(true);
    try {
      const result = await apiRequest<LeftoverTransaction>(
        "/leftover-inventory",
        accessToken,
        onSignOut,
        {
          method: "POST",
          body: JSON.stringify({
            recordedByName: recordedByName.trim(),
            stocktakeDate,
            lines: rows,
          }),
        },
      );
      setQuantities({});
      setNotice("Leftover stocktake saved. " + result.lines.length + " ingredient quantities recorded.");
      await loadHistory(1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save leftover stocktake.");
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(id: string) {
    setDetailLoading(true);
    setError("");
    try {
      const result = await apiRequest<LeftoverTransaction>(
        "/leftover-inventory/" + id,
        accessToken,
        onSignOut,
      );
      setDetail(result);
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "Unable to load stocktake details.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function clearHistoryFilters() {
    setFrom("");
    setTo("");
    setCategoryFilter("");
    setRecordedByFilter("");
    setHistoryLoading(true);
    setError("");
    try {
      const result = await apiRequest<HistoryResponse>(
        "/leftover-inventory/history?page=1&pageSize=10",
        accessToken,
        onSignOut,
      );
      setHistory(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load leftover history.");
    } finally {
      setHistoryLoading(false);
    }
  }

  const detailGroupMap = new Map<string, { name: string; lines: LeftoverLine[] }>();
  for (const line of detail?.lines ?? []) {
    const group = detailGroupMap.get(line.inventoryCategoryId);
    if (group) {
      group.lines.push(line);
    } else {
      detailGroupMap.set(line.inventoryCategoryId, {
        name: line.inventoryCategoryNameSnapshot,
        lines: [line],
      });
    }
  }
  const detailGroups = [...detailGroupMap.values()];

  return (
    <div className="leftover-inventory-panel">
      <section className="purchase-entry-card">
        <div className="purchase-section-heading">
          <div>
            <p className="purchase-eyebrow">STOCKTAKE</p>
            <h2>Leftover Inventory</h2>
            <p className="purchase-muted">Record the remaining quantity for each ingredient in its base unit. Blank means not counted; 0 means none left.</p>
          </div>
          <span className="purchase-draft-status">Signed in as {signedInEmail}</span>
        </div>

        <div className="purchase-recorder-row leftover-recorder-row">
          <label>
            <span>Person recording this stocktake</span>
            <input value={recordedByName} maxLength={120} placeholder="Enter staff member name" onChange={(event) => setRecordedByName(event.target.value)} />
          </label>
          <label>
            <span>Stocktake date</span>
            <input type="date" value={stocktakeDate} onChange={(event) => setStocktakeDate(event.target.value)} />
          </label>
        </div>

        <div className="purchase-tabs" role="tablist" aria-label="Leftover inventory categories">
          {categories.map((category) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeCategoryId === category.id}
              className={activeCategoryId === category.id ? "active" : ""}
              key={category.id}
              onClick={() => setActiveCategoryId(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>

        {activeCategory ? (
          <>
            <div className="purchase-lines-heading">
              <h3>{activeCategory.name}</h3>
              <span>{activeIngredients.length} active ingredients assigned</span>
            </div>
            {activeIngredients.length ? (
              <div className="purchase-table-wrap">
                <table className="leftover-line-table">
                  <thead><tr><th>Ingredient</th><th>Base unit</th><th>Leftover quantity</th></tr></thead>
                  <tbody>
                    {activeIngredients.map((ingredient) => (
                      <tr key={ingredient.id}>
                        <td data-label="Ingredient"><strong>{ingredient.name}</strong><small>{ingredient.code}</small></td>
                        <td data-label="Base unit">{ingredient.baseUnit.name} ({ingredient.baseUnit.symbol})</td>
                        <td data-label="Leftover quantity">
                          <input
                            className="purchase-number-input"
                            type="number"
                            min="0"
                            step="0.000001"
                            inputMode="decimal"
                            value={quantities[ingredient.id] ?? ""}
                            placeholder="Leave blank if not counted"
                            onChange={(event) => {
                              const value = event.target.value;
                              setQuantities((current) => ({ ...current, [ingredient.id]: value }));
                            }}
                            aria-label={"Leftover quantity for " + ingredient.name + " in " + ingredient.baseUnit.symbol}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="purchase-alert purchase-alert-info">
                No active ingredients are assigned to {activeCategory.name}. Assign ingredients to this inventory purchasing category in the Ingredient Catalogue before recording leftover stock.
              </div>
            )}
          </>
        ) : (
          <div className="purchase-empty">No active inventory purchasing categories are available.</div>
        )}

        <div className="leftover-submit-row">
          <span>{enteredCount} ingredient quantity field{enteredCount === 1 ? "" : "s"} filled across all categories</span>
          <button type="button" className="purchase-button purchase-button-primary" onClick={() => void saveStocktake()} disabled={saving || enteredCount === 0}>
            {saving ? "Saving stocktake…" : "Save stocktake"}
          </button>
        </div>
        {error && <div className="purchase-alert purchase-alert-error" role="alert">{error}</div>}
        {notice && <div className="purchase-alert purchase-alert-success" role="status">{notice}</div>}
      </section>

      <section className="purchase-history-card">
        <div className="purchase-section-heading">
          <div>
            <p className="purchase-eyebrow">RECORDS</p>
            <h2>Leftover stocktake history</h2>
            <p className="purchase-muted">The latest transactions are shown first. Open a record to see every saved ingredient and quantity.</p>
          </div>
          <button type="button" className="purchase-button purchase-button-secondary" onClick={() => void loadHistory(1)} disabled={historyLoading}>Refresh history</button>
        </div>
        <div className="purchase-filters leftover-history-filters">
          <label><span>From date</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label><span>To date</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          <label>
            <span>Category</span>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="">All categories</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label><span>Recorded by</span><input value={recordedByFilter} onChange={(event) => setRecordedByFilter(event.target.value)} placeholder="Name or email" /></label>
        </div>
        <div className="purchase-filter-actions">
          <button type="button" className="purchase-button purchase-button-primary" onClick={() => void loadHistory(1)} disabled={historyLoading}>Apply filters</button>
          <button type="button" className="purchase-button purchase-button-secondary" onClick={() => void clearHistoryFilters()} disabled={historyLoading}>Clear filters</button>
          <span>{history ? history.total + " transaction" + (history.total === 1 ? "" : "s") + " found" : ""}</span>
        </div>
        <div className="purchase-history-table-wrap">
          <table className="leftover-history-table">
            <thead><tr><th>Stocktake date</th><th>Categories</th><th>Ingredients recorded</th><th>Recorded by</th><th></th></tr></thead>
            <tbody>
              {historyLoading ? (
                <tr><td colSpan={5} className="purchase-empty-cell">Loading leftover history…</td></tr>
              ) : !history?.items.length ? (
                <tr><td colSpan={5} className="purchase-empty-cell">No leftover stocktakes found.</td></tr>
              ) : history.items.map((item) => (
                <tr key={item.id}>
                  <td>{displayDate(item.stocktakeDate)}</td>
                  <td>{item.categories.map((category) => category.name).join(", ")}</td>
                  <td>{item._count.lines}</td>
                  <td><strong>{item.recordedByName}</strong><small>{item.recordedByEmail}</small></td>
                  <td><button type="button" className="purchase-text-button" onClick={() => void openDetail(item.id)}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {history && history.totalPages > 1 && (
          <div className="purchase-pagination">
            <button type="button" className="purchase-button purchase-button-secondary" disabled={history.page <= 1 || historyLoading} onClick={() => void loadHistory(history.page - 1)}>Previous</button>
            <span>Page {history.page} of {history.totalPages}</span>
            <button type="button" className="purchase-button purchase-button-secondary" disabled={history.page >= history.totalPages || historyLoading} onClick={() => void loadHistory(history.page + 1)}>Next</button>
          </div>
        )}
      </section>

      {(detail || detailLoading) && (
        <div className="purchase-modal-backdrop" role="presentation">
          <section className="purchase-modal purchase-detail-modal" role="dialog" aria-modal="true" aria-labelledby="leftover-detail-title">
            <div className="purchase-modal-header">
              <div><p className="purchase-eyebrow">LEFTOVER STOCKTAKE</p><h2 id="leftover-detail-title">{detail ? displayDate(detail.stocktakeDate) : "Loading…"}</h2></div>
              <button type="button" className="purchase-modal-close" onClick={() => setDetail(null)} aria-label="Close details">×</button>
            </div>
            {detailLoading || !detail ? <p>Loading original stocktake…</p> : (
              <>
                <div className="purchase-detail-meta">
                  <span>Recorded by <strong>{detail.recordedByName}</strong><small> {detail.recordedByEmail}</small></span>
                  <span>Stocktake date <strong>{displayDate(detail.stocktakeDate)}</strong></span>
                  <span>Saved <strong>{new Date(detail.createdAt).toLocaleString("en-IN")}</strong></span>
                  <span>Ingredients <strong>{detail.lines.length}</strong></span>
                </div>
                {detailGroups.map((group) => (
                  <div className="purchase-review-sheet" key={group.name}>
                    <h3>{group.name}</h3>
                    <ul>{group.lines.map((line) => (
                      <li key={line.id}>
                        <span>{line.ingredientNameSnapshot} ({line.ingredientCodeSnapshot})</span>
                        <strong>{line.quantity} {line.baseUnitSymbolSnapshot}</strong>
                      </li>
                    ))}</ul>
                  </div>
                ))}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
