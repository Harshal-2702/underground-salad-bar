import { useCallback, useEffect, useMemo, useState } from "react";
import { API_URL } from "../src/config.ts";
import "../src/nc.css";

type MenuCategory = { id: string; name: string; subtitle: string; pricePerScoop: number; items: string[]; note?: string | null };
type SignatureBowl = { id: string; name: string; tagline: string; description: string; price: number; tag: string; tagColor: string; accentColor: string };
type MenuResponse = { categories: MenuCategory[]; signatureBowls: SignatureBowl[] };
type ConsumerType = "STAFF" | "OWNER" | "GUEST" | "VENDOR" | "PARTNER" | "OTHER";
type Purpose = "STAFF_MEAL" | "MANAGEMENT" | "GUEST_COMPLIMENTARY" | "VENDOR_PARTNER" | "TASTING_QC" | "TRAINING" | "OTHER";
type Mode = "PREPARE_NOW" | "ALREADY_CONSUMED";
type Status = "QUEUED" | "PREPARING" | "READY" | "COMPLETED" | "VOIDED";
type SelectedItem = { name: string; category: string; scoops: number; veggieSelection?: string[] };
type NcItem = { categoryIdSnapshot: string; categoryNameSnapshot: string; itemNameSnapshot: string; scoops: string | number; unitPriceSnapshot: string | number; lineValue: string | number; selectedOptions?: string[] | null };
type NcEntry = {
  id: string; reference: string; businessDate: string; purpose: Purpose; mode: Mode; status: Status;
  consumerType: ConsumerType; consumerName: string; notes: string | null; recordedByEmail: string;
  completedAt: string | null; voidReason: string | null; menuValue: string | number; createdAt: string; items: NcItem[];
};

const PURPOSES: Array<{ value: Purpose; label: string }> = [
  { value: "STAFF_MEAL", label: "Staff meal" },
  { value: "MANAGEMENT", label: "Owner / management" },
  { value: "GUEST_COMPLIMENTARY", label: "Guest complimentary" },
  { value: "VENDOR_PARTNER", label: "Vendor / partner" },
  { value: "TASTING_QC", label: "Tasting / quality check" },
  { value: "TRAINING", label: "Training" },
  { value: "OTHER", label: "Other" },
];
const CONSUMER_TYPES: Array<{ value: ConsumerType; label: string }> = [
  { value: "STAFF", label: "Staff member" }, { value: "OWNER", label: "Owner / manager" },
  { value: "GUEST", label: "Guest" }, { value: "VENDOR", label: "Vendor" },
  { value: "PARTNER", label: "Partner" }, { value: "OTHER", label: "Other" },
];

function money(value: unknown): number { const n = Number(value ?? 0); return Number.isFinite(n) ? n : 0; }
function inr(value: unknown): string { return "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(money(value)); }
function dateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const p = (k: string) => parts.find(x => x.type === k)?.value ?? "";
  return p("year") + "-" + p("month") + "-" + p("day");
}
function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
}
function statusLabel(status: Status): string {
  return ({ QUEUED: "Queued for kitchen", PREPARING: "Preparing", READY: "Ready", COMPLETED: "Completed", VOIDED: "Voided" })[status];
}
function purposeLabel(purpose: Purpose): string { return PURPOSES.find(x => x.value === purpose)?.label ?? purpose; }

async function request<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body?.error === "string" ? body.error : "The request could not be completed.");
  return body as T;
}

export default function NCPage({
  accessToken, signedInEmail, onBackToOrders, onSignOut,
}: { accessToken: string; signedInEmail: string; onBackToOrders: () => void; onSignOut: () => Promise<void> }) {
  const [menu, setMenu] = useState<MenuCategory[]>([]);
  const [signatureBowls, setSignatureBowls] = useState<SignatureBowl[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState("");
  const [entries, setEntries] = useState<NcEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [entriesError, setEntriesError] = useState("");
  const [purpose, setPurpose] = useState<Purpose>("STAFF_MEAL");
  const [consumerType, setConsumerType] = useState<ConsumerType>("STAFF");
  const [consumerName, setConsumerName] = useState("");
  const [mode, setMode] = useState<Mode>("PREPARE_NOW");
  const [notes, setNotes] = useState("");
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [selectedVeggies, setSelectedVeggies] = useState<string[]>([]);
  const [veggieScoops, setVeggieScoops] = useState(1);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<"ACTIVE" | "ALL" | "COMPLETED">("ACTIVE");
  const [voidTarget, setVoidTarget] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [busyEntry, setBusyEntry] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    setEntriesLoading(true); setEntriesError("");
    try {
      const data = await request<NcEntry[]>(API_URL + "/nc?date=" + dateKey(), accessToken);
      setEntries(data);
    } catch (error) {
      setEntriesError(error instanceof Error ? error.message : "Unable to load NC entries.");
    } finally { setEntriesLoading(false); }
  }, [accessToken]);

  useEffect(() => {
    let active = true;
    fetch(API_URL + "/menu")
      .then(async response => { if (!response.ok) throw new Error("Unable to load the live menu."); return response.json(); })
      .then((data: MenuResponse) => {
        if (!active) return;
        if (Array.isArray(data.categories)) setMenu(data.categories);
        if (Array.isArray(data.signatureBowls)) setSignatureBowls(data.signatureBowls);
      })
      .catch(error => { if (active) setMenuError(error instanceof Error ? error.message : "Unable to load the live menu."); })
      .finally(() => { if (active) setMenuLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => { void loadEntries(); }, [loadEntries]);

  const menuItems = useMemo(() => {
    const regular = selectedItems.map(item => ({ ...item }));
    if (selectedVeggies.length > 0 && veggieScoops > 0) {
      regular.push({ name: "Veggie Scoop", category: "veggies", scoops: veggieScoops, veggieSelection: selectedVeggies });
    }
    return regular;
  }, [selectedItems, selectedVeggies, veggieScoops]);

  const estimate = useMemo(() => menuItems.reduce((total, item) => {
    const category = menu.find(x => x.id === item.category);
    const signature = item.category === "signature" ? signatureBowls.find((bowl) => bowl.name === item.name) : undefined;
    return total + (signature?.price ?? category?.pricePerScoop ?? 0) * item.scoops;
  }, 0), [menuItems, menu]);

  const changeItem = (category: MenuCategory, name: string, direction: 1 | -1) => {
    setFormError(""); setNotice("");
    if (category.id === "veggies") {
      const exists = selectedVeggies.includes(name);
      const next = direction === 1 ? (exists ? selectedVeggies : [...selectedVeggies, name]) : selectedVeggies.filter(x => x !== name);
      setSelectedVeggies(next);
      if (!next.length) setVeggieScoops(0);
      else if (!veggieScoops) setVeggieScoops(1);
      return;
    }
    setSelectedItems(current => {
      const existing = current.find(x => x.category === category.id && x.name === name);
      if (category.id === "beans") {
        const beans = current.filter(x => x.category === "beans");
        if (direction === 1 && !existing) {
          if (beans.length >= 2) return current;
          if (beans.length === 1) return current.map(x => x.category === "beans" ? { ...x, scoops: 0.5 } : x).concat({ name, category: category.id, scoops: 0.5 });
          return [...current, { name, category: category.id, scoops: 1 }];
        }
        if (direction === 1 && existing) {
          return beans.length === 1
            ? current.map(x => x === existing ? { ...x, scoops: x.scoops + 1 } : x)
            : current.map(x => x.category === "beans" ? { ...x, scoops: x.scoops + 0.5 } : x);
        }
        if (!existing) return current;
        if (beans.length === 1) return existing.scoops > 1 ? current.map(x => x === existing ? { ...x, scoops: x.scoops - 1 } : x) : current.filter(x => x !== existing);
        if (beans.every(x => x.scoops === 0.5)) return current.filter(x => x !== existing).map(x => x.category === "beans" ? { ...x, scoops: 1 } : x);
        return current.map(x => x.category === "beans" ? { ...x, scoops: x.scoops - 0.5 } : x);
      }
      if (direction === 1) return existing
        ? current.map(x => x === existing ? { ...x, scoops: x.scoops + 1 } : x)
        : [...current, { name, category: category.id, scoops: 1 }];
      if (!existing) return current;
      return existing.scoops > 1 ? current.map(x => x === existing ? { ...x, scoops: x.scoops - 1 } : x) : current.filter(x => x !== existing);
    });
  };

  const changeSignature = (name: string, direction: 1 | -1) => {
    setFormError(""); setNotice("");
    setSelectedItems((current) => {
      const existing = current.find((item) => item.category === "signature" && item.name === name);
      if (direction === 1) {
        return existing
          ? current.map((item) => item === existing ? { ...item, scoops: Math.min(20, item.scoops + 1) } : item)
          : [...current, { name, category: "signature", scoops: 1 }];
      }
      if (!existing) return current;
      return existing.scoops > 1
        ? current.map((item) => item === existing ? { ...item, scoops: item.scoops - 1 } : item)
        : current.filter((item) => item !== existing);
    });
  };

  const clearSelection = () => { setSelectedItems([]); setSelectedVeggies([]); setVeggieScoops(1); };

  const saveEntry = async () => {
    setFormError(""); setNotice("");
    if (!consumerName.trim()) { setFormError("Enter the name of the person who consumed the food."); return; }
    if (menuItems.length === 0) { setFormError("Select at least one item from the live menu."); return; }
    setSaving(true);
    try {
      const created = await request<NcEntry>(API_URL + "/nc", accessToken, {
        method: "POST",
        body: JSON.stringify({ consumerName: consumerName.trim(), consumerType, purpose, mode, notes, items: menuItems }),
      });
      setNotice(created.reference + " saved. Estimated menu value " + inr(created.menuValue) + ".");
      setConsumerName(""); setNotes(""); clearSelection(); setMode("PREPARE_NOW");
      await loadEntries();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save this NC entry.");
    } finally { setSaving(false); }
  };

  const changeStatus = async (entry: NcEntry, status: Status, reason?: string) => {
    setBusyEntry(entry.id); setEntriesError("");
    try {
      await request(API_URL + "/nc/" + entry.id + "/status", accessToken, {
        method: "PATCH", body: JSON.stringify({ status, reason }),
      });
      setVoidTarget(null); setVoidReason("");
      await loadEntries();
    } catch (error) {
      setEntriesError(error instanceof Error ? error.message : "Unable to update NC status.");
    } finally { setBusyEntry(null); }
  };

  const visibleEntries = entries.filter(entry => {
    if (filter === "ACTIVE") return ["QUEUED", "PREPARING", "READY"].includes(entry.status);
    if (filter === "COMPLETED") return entry.status === "COMPLETED";
    return true;
  });
  const activeCount = entries.filter(entry => ["QUEUED", "PREPARING", "READY"].includes(entry.status)).length;
  const dayMenuValue = entries.filter(entry => entry.status !== "VOIDED").reduce((sum, entry) => sum + money(entry.menuValue), 0);

  return (
    <main className="nc-shell">
      <header className="nc-header">
        <div>
          <p className="nc-eyebrow">UNDERGROUND KITCHEN OS</p>
          <h1>NC Entry</h1>
          <p>Internal consumption · No customer billing or sales order is created</p>
        </div>
        <div className="nc-header-actions">
          <button type="button" className="nc-button nc-button-secondary" onClick={onBackToOrders}>← Kitchen Orders</button>
          <button type="button" className="nc-button nc-button-secondary" onClick={() => void loadEntries()}>Refresh</button>
          <button type="button" className="nc-button nc-button-quiet" onClick={() => void onSignOut()}>Sign out</button>
        </div>
      </header>

      <div className="nc-summary-strip">
        <div><span>Today's NC entries</span><strong>{entries.length}</strong></div>
        <div><span>Awaiting kitchen</span><strong>{activeCount}</strong></div>
        <div><span>Estimated menu value</span><strong>{inr(dayMenuValue)}</strong></div>
        <small>Today · IST · Voided entries excluded from menu value</small>
      </div>

      <section className="nc-entry-panel">
        <div className="nc-panel-heading">
          <div><span className="nc-step">NEW ENTRY</span><h2>Record something from the kitchen</h2><p>Who ate it, what they had, and why it was no charge.</p></div>
          <span className="nc-identity">Recorded by {signedInEmail}</span>
        </div>

        <div className="nc-form-grid">
          <label className="nc-field"><span>Person who consumed it *</span><input value={consumerName} onChange={event => setConsumerName(event.target.value)} maxLength={120} placeholder="Enter person's name"/></label>
          <label className="nc-field"><span>Person type</span><select value={consumerType} onChange={event => setConsumerType(event.target.value as ConsumerType)}>{CONSUMER_TYPES.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
          <label className="nc-field"><span>NC reason</span><select value={purpose} onChange={event => setPurpose(event.target.value as Purpose)}>{PURPOSES.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
          <label className="nc-field"><span>Entry type</span><select value={mode} onChange={event => setMode(event.target.value as Mode)}><option value="PREPARE_NOW">Prepare now · send to kitchen queue</option><option value="ALREADY_CONSUMED">Already consumed / taken from stock</option></select></label>
          <label className="nc-field nc-notes-field"><span>Notes / description (optional)</span><input value={notes} onChange={event => setNotes(event.target.value)} maxLength={1000} placeholder="e.g. Staff lunch after the morning shift"/></label>
        </div>

        <div className="nc-menu-heading">
          <div><h3>Select menu items</h3><p>Live menu shared with the customer website. Prices are saved as snapshots.</p></div>
          {menuError && <span className="nc-inline-error">{menuError}</span>}
          <strong>Estimated value · {inr(estimate)}</strong>
        </div>
        {menuLoading ? <p className="nc-loading">Loading current customer menu…</p> : menu.length === 0 ? <p className="nc-inline-error">The shared menu is unavailable. No NC entry can be saved until it loads.</p> : (
          <div className="nc-menu-grid">
            {signatureBowls.length > 0 && <section className="nc-category">
              <div className="nc-category-title"><div><strong>Signature bowls</strong><small>Chef-curated menu favourites</small></div><b>Fixed menu price</b></div>
              <div className="nc-items-grid">{signatureBowls.map((bowl) => {
                const selected = selectedItems.find((item) => item.category === "signature" && item.name === bowl.name);
                return <div className={"nc-menu-item " + (selected ? "is-selected" : "")} key={bowl.id}>
                  <span>{bowl.name}<small className="nc-signature-tag">{bowl.tagline}</small></span>
                  <div><small>{inr(bowl.price)}</small>{selected
                    ? <div className="nc-qty-control"><button type="button" onClick={() => changeSignature(bowl.name,-1)}>−</button><b>{selected.scoops}</b><button type="button" onClick={() => changeSignature(bowl.name,1)}>+</button></div>
                    : <button type="button" className="nc-add" onClick={() => changeSignature(bowl.name,1)}>+ Add</button>}
                  </div>
                </div>;
              })}</div>
            </section>}
            {menu.map(category => (
              <section className="nc-category" key={category.id}>
                <div className="nc-category-title"><div><strong>{category.name}</strong><small>{category.subtitle}</small></div><b>{inr(category.pricePerScoop)} / scoop</b></div>
                {category.id === "veggies" ? (
                  <>
                    <div className="nc-veggie-grid">{category.items.map(item => <button type="button" key={item} className={"nc-chip " + (selectedVeggies.includes(item) ? "is-selected" : "")} onClick={() => changeItem(category, item, selectedVeggies.includes(item) ? -1 : 1)}>{selectedVeggies.includes(item) ? "✓ " : "+ "}{item}</button>)}</div>
                    {selectedVeggies.length > 0 && <div className="nc-qty-row"><span>{selectedVeggies.length} veggie varieties · {inr(category.pricePerScoop)} per scoop</span><div><button type="button" onClick={() => setVeggieScoops(x => Math.max(1, x - 1))}>−</button><b>{veggieScoops}</b><button type="button" onClick={() => setVeggieScoops(x => Math.min(50, x + 1))}>+</button></div></div>}
                  </>
                ) : (
                  <div className="nc-items-grid">{category.items.map(item => {
                    const selected = selectedItems.find(x => x.category === category.id && x.name === item);
                    const beanLimit = category.id === "beans" && !selected && selectedItems.filter(x => x.category === "beans").length >= 2;
                    return <div className={"nc-menu-item " + (selected ? "is-selected" : "")} key={item}>
                      <span>{item}</span>
                      <div><small>{inr(category.pricePerScoop)}</small>{selected
                        ? <div className="nc-qty-control"><button type="button" onClick={() => changeItem(category,item,-1)}>−</button><b>{selected.scoops}</b><button type="button" disabled={category.id === "beans" && selectedItems.filter(x => x.category === "beans").length >= 2 && selected.scoops >= 25} onClick={() => changeItem(category,item,1)}>+</button></div>
                        : <button type="button" disabled={beanLimit} className="nc-add" onClick={() => changeItem(category,item,1)}>+ Add</button>}
                      </div>
                    </div>;
                  })}</div>
                )}
                {category.note && <small className="nc-category-note">{category.note}</small>}
              </section>
            ))}
          </div>
        )}

        <div className="nc-save-row">
          <span>{menuItems.length} selected line{menuItems.length === 1 ? "" : "s"} · {inr(estimate)} estimated menu value</span>
          <div><button type="button" className="nc-button nc-button-secondary" onClick={clearSelection}>Clear selection</button><button type="button" className="nc-button nc-button-primary" onClick={() => void saveEntry()} disabled={saving || menuLoading || !menu.length}>{saving ? "Saving…" : mode === "PREPARE_NOW" ? "Save & send to kitchen" : "Record consumed"} </button></div>
        </div>
        {formError && <p className="nc-alert nc-alert-error" role="alert">{formError}</p>}
        {notice && <p className="nc-alert nc-alert-success" role="status">{notice}</p>}
      </section>

      <section className="nc-register-panel">
        <div className="nc-panel-heading">
          <div><span className="nc-step">TODAY'S REGISTER</span><h2>NC entries & kitchen queue</h2><p>Separate from customer orders, invoices and payment totals.</p></div>
          <div className="nc-filter-tabs"><button className={filter === "ACTIVE" ? "is-active" : ""} onClick={() => setFilter("ACTIVE")}>Kitchen queue</button><button className={filter === "ALL" ? "is-active" : ""} onClick={() => setFilter("ALL")}>All entries</button><button className={filter === "COMPLETED" ? "is-active" : ""} onClick={() => setFilter("COMPLETED")}>Completed</button></div>
        </div>
        {entriesError && <p className="nc-alert nc-alert-error">{entriesError}</p>}
        {entriesLoading ? <p className="nc-loading">Loading today's NC register…</p> : visibleEntries.length === 0 ? <p className="nc-empty">No NC entries in this view today.</p> : (
          <div className="nc-entry-list">{visibleEntries.map(entry => <article className="nc-entry-card" key={entry.id}>
            <div className="nc-entry-main">
              <div className="nc-entry-ref"><strong>{entry.reference}</strong><span className={"nc-status nc-status-" + entry.status.toLowerCase()}>{statusLabel(entry.status)}</span><small>{formatTime(entry.createdAt)}</small></div>
              <div className="nc-entry-person"><strong>{entry.consumerName}</strong><span>{purposeLabel(entry.purpose)} · {CONSUMER_TYPES.find(x => x.value === entry.consumerType)?.label}</span></div>
              <div className="nc-entry-value"><strong>{inr(entry.menuValue)}</strong><small>Estimated menu value</small></div>
            </div>
            <div className="nc-entry-items">{entry.items.map((item,index) => <span key={index}>{item.itemNameSnapshot}{item.scoops ? " × " + item.scoops : ""}{Array.isArray(item.selectedOptions) && item.selectedOptions.length ? " (" + item.selectedOptions.join(", ") + ")" : ""}</span>)}</div>
            <div className="nc-entry-meta"><span>Entered by {entry.recordedByEmail}</span>{entry.notes && <span>Note: {entry.notes}</span>}</div>
            {entry.status === "VOIDED" && entry.voidReason && <p className="nc-void-reason">Void reason: {entry.voidReason}</p>}
            {entry.status !== "COMPLETED" && entry.status !== "VOIDED" && <div className="nc-entry-actions">
              {entry.status === "QUEUED" && <button type="button" onClick={() => void changeStatus(entry,"PREPARING")} disabled={busyEntry === entry.id}>Start preparing</button>}
              {entry.status === "QUEUED" || entry.status === "PREPARING" ? <button type="button" onClick={() => void changeStatus(entry,"READY")} disabled={busyEntry === entry.id}>Mark ready</button> : null}
              {entry.status === "QUEUED" || entry.status === "PREPARING" || entry.status === "READY" ? <button type="button" className="is-primary" onClick={() => void changeStatus(entry,"COMPLETED")} disabled={busyEntry === entry.id}>Complete</button> : null}
              <button type="button" className="is-void" onClick={() => { setVoidTarget(entry.id); setVoidReason(""); }}>Void</button>
            </div>}
            {voidTarget === entry.id && <div className="nc-void-form"><input value={voidReason} onChange={event => setVoidReason(event.target.value)} placeholder="Reason for voiding this NC entry" maxLength={500}/><button type="button" onClick={() => void changeStatus(entry,"VOIDED",voidReason)} disabled={!voidReason.trim() || busyEntry === entry.id}>Confirm void</button><button type="button" onClick={() => setVoidTarget(null)}>Cancel</button></div>}
          </article>)}</div>
        )}
      </section>

      <footer className="nc-footer">NC = No Charge · Internal consumption only · Menu values are historical estimates, not sales or food cost</footer>
    </main>
  );
}
