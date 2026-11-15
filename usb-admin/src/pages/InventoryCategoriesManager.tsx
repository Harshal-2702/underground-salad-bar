import { useState, type FormEvent } from "react";
import { API_URL } from "../config";
import "../inventory-categories.css";

export type InventoryCategory = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

type Props = {
  categories: InventoryCategory[];
  accessToken: string;
  onSignOut: () => Promise<void>;
  onSaved: () => Promise<void>;
};

type FormState = { code: string; name: string; sortOrder: string };
const emptyForm: FormState = { code: "", name: "", sortOrder: "0" };

function responseError(value: unknown, fallback: string): string {
  if (value && typeof value === "object" && "error" in value && typeof value.error === "string") {
    return value.error;
  }
  return fallback;
}

export default function InventoryCategoriesManager({ categories, accessToken, onSignOut, onSaved }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function beginCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setNotice("");
  }

  function beginEdit(category: InventoryCategory) {
    setEditingId(category.id);
    setForm({ code: category.code, name: category.name, sortOrder: String(category.sortOrder) });
    setError("");
    setNotice("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_URL}/inventory-categories${editingId ? `/${editingId}` : ""}`, {
        method: editingId ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: form.code.trim(),
          name: form.name.trim(),
          sortOrder: Number(form.sortOrder || 0),
        }),
      });
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
        throw new Error("This account is not authorised to manage inventory categories.");
      }
      if (!response.ok) {
        throw new Error(responseError(payload, `Request failed (${response.status}).`));
      }
      await onSaved();
      setEditingId(null);
      setForm(emptyForm);
      setNotice(editingId ? "Inventory category updated." : "Inventory category added.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save this category.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="inventory-category-manager">
      <div className="inventory-category-manager-heading">
        <div>
          <div className="catalogue-eyebrow">SHARED MASTER DATA</div>
          <h2>Inventory purchasing categories</h2>
          <p>One list shared by ingredient records, Purchase Register and Remaining Stock.</p>
        </div>
        <button
          type="button"
          className="catalogue-button catalogue-button-secondary"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? "Hide categories" : "Manage categories"}
        </button>
      </div>

      {expanded && (
        <div className="inventory-category-manager-body">
          {error && <div className="catalogue-message catalogue-message-error" role="alert">{error}</div>}
          {notice && <div className="catalogue-message catalogue-message-success" role="status">{notice}</div>}

          <div className="inventory-category-list">
            {categories.map((category) => (
              <article className="inventory-category-item" key={category.id}>
                <div>
                  <strong>{category.name}</strong>
                  <span>Code: {category.code} Â· Display order: {category.sortOrder}</span>
                </div>
                <div className="inventory-category-item-actions">
                  <span className={`catalogue-status ${category.isActive ? "is-active" : "is-archived"}`}>
                    {category.isActive ? "Active" : "Inactive"}
                  </span>
                  <button
                    type="button"
                    className="catalogue-text-button"
                    onClick={() => beginEdit(category)}
                    disabled={saving || !category.isActive}
                  >
                    Edit
                  </button>
                </div>
              </article>
            ))}
            {categories.length === 0 && <p className="catalogue-muted">No inventory purchasing categories found.</p>}
          </div>

          <form className="inventory-category-form" onSubmit={(event) => void save(event)}>
            <div>
              <h3>{editingId ? "Edit category" : "Add a category"}</h3>
              <p>Category codes are unique and stored in uppercase.</p>
            </div>
            <div className="inventory-category-form-fields">
              <label>
                Category code
                <input required maxLength={40} value={form.code}
                  onChange={(event) => setForm({ ...form, code: event.target.value })}
                  placeholder="e.g. DAIRY" />
              </label>
              <label>
                Category name
                <input required maxLength={100} value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="e.g. Dairy" />
              </label>
              <label>
                Display order
                <input type="number" min="0" max="1000000" value={form.sortOrder}
                  onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} />
              </label>
            </div>
            <div className="inventory-category-form-actions">
              <button className="catalogue-button catalogue-button-primary" disabled={saving}>
                {saving ? "Savingâ€¦" : editingId ? "Save changes" : "Add category"}
              </button>
              {editingId && (
                <button type="button" className="catalogue-button catalogue-button-quiet"
                  onClick={beginCreate} disabled={saving}>Cancel edit</button>
              )}
            </div>
          </form>
        </div>
      )}
    </section>
  );
}