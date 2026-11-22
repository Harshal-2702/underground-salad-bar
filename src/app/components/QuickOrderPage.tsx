import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, Minus, Plus, Sparkles, Trash2 } from "lucide-react";
import { API_URL } from "../config";
import { BOWL_CATEGORIES, type Bowl, type BowlItem } from "./BowlBuilder";
import { DELIVERY_AREAS } from "./Cart";
import "./QuickOrderPage.css";

type CategoryDefinition = {
  id: string;
  name: string;
  subtitle: string;
  pricePerScoop: number;
  items: readonly string[];
  note?: string | null;
};

type CustomerForm = {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  area: string;
  city: "Pune";
};

const CATEGORY_META: Record<string, { icon: string; helper: string }> = {
  base: { icon: "🌾", helper: "Start with your favourite foundation." },
  protein: { icon: "🔥", helper: "Pick one, or mix your favourites." },
  veggies: { icon: "🥬", helper: "Mix as many varieties as you like in each scoop." },
  beans: { icon: "🫘", helper: "Add a little extra goodness. Up to two varieties." },
  dressing: { icon: "✨", helper: "Finish it with something delicious." },
};

const INITIAL_FORM: CustomerForm = {
  firstName: "",
  lastName: "",
  phone: "",
  address: "",
  area: "",
  city: "Pune",
};

function makeId(prefix: string): string {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

function priceOf(items: BowlItem[]): number {
  return Math.round(items.reduce((sum, item) => sum + item.price * item.scoops, 0) * 100) / 100;
}

function formatMoney(value: number): string {
  return "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

function QuickOrderField({
  label, value, onChange, placeholder, type = "text", maxLength, error, autoComplete,
}: {
  label: string; value: string; onChange: (value: string) => void; placeholder?: string;
  type?: string; maxLength?: number; error?: string; autoComplete?: string;
}) {
  return (
    <label className="qo-field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
      />
      {error && <small className="qo-field-error">{error}</small>}
    </label>
  );
}

export function QuickOrderPage() {
  const [form, setForm] = useState<CustomerForm>(INITIAL_FORM);
  const [draftItems, setDraftItems] = useState<BowlItem[]>([]);
  const [selectedVeggies, setSelectedVeggies] = useState<string[]>([]);
  const [veggieScoops, setVeggieScoops] = useState(0);
  const [bowls, setBowls] = useState<Bowl[]>([]);
  const [editingBowlId, setEditingBowlId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<{ total: number; kotNumber?: string; invoiceNumber?: string } | null>(null);
  const [showAllSummary, setShowAllSummary] = useState(false);
  const categories = BOWL_CATEGORIES as readonly CategoryDefinition[];

  useEffect(() => {
    const originalTitle = document.title;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const originalDescription = description?.content;
    const originalCanonical = canonical?.href;
    document.title = "Quick Order | Underground Salad Bar";
    if (description) description.content = "Build your favourite bowl and order directly from Underground Salad Bar in Pune. Fresh, custom bowls made your way.";
    if (canonical) canonical.href = window.location.origin + "/quick-order";
    return () => {
      document.title = originalTitle;
      if (description && originalDescription) description.content = originalDescription;
      if (canonical && originalCanonical) canonical.href = originalCanonical;
    };
  }, []);

  const selectedArea = DELIVERY_AREAS.find((area) => area.name === form.area);
  const deliveryCharge = selectedArea?.deliveryCharge ?? 0;
  const bowlSubtotal = bowls.reduce((sum, bowl) => sum + bowl.total, 0);
  const estimatedTotal = bowlSubtotal + deliveryCharge;
  const draftBowlItems = useMemo(() => {
    const items = [...draftItems];
    if (selectedVeggies.length > 0 && veggieScoops > 0) {
      items.push({
        id: "quick-order-veggie-draft",
        name: "Veggie Scoop",
        category: "veggies",
        price: categories.find((category) => category.id === "veggies")?.pricePerScoop ?? 40,
        scoops: veggieScoops,
        veggieSelection: selectedVeggies,
      });
    }
    return items;
  }, [categories, draftItems, selectedVeggies, veggieScoops]);
  const draftTotal = priceOf(draftBowlItems);

  const updateForm = (key: keyof CustomerForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  };

  const changeIngredient = (category: string, itemName: string, direction: 1 | -1) => {
    if (category === "veggies") {
      setSelectedVeggies((current) => {
        const exists = current.includes(itemName);
        const next = direction === 1
          ? (exists ? current : [...current, itemName])
          : current.filter((item) => item !== itemName);
        if (next.length > 0 && veggieScoops === 0) setVeggieScoops(1);
        if (next.length === 0) setVeggieScoops(0);
        return next;
      });
      return;
    }

    setDraftItems((current) => {
      const existing = current.find((item) => item.category === category && item.name === itemName);
      if (category !== "beans") {
        if (direction === 1) {
          if (existing) return current.map((item) => item.id === existing.id ? { ...item, scoops: item.scoops + 1 } : item);
          const rate = categories.find((item) => item.id === category)?.pricePerScoop ?? 0;
          return [...current, { id: makeId(category), name: itemName, category, price: rate, scoops: 1 }];
        }
        if (!existing) return current;
        return existing.scoops > 1
          ? current.map((item) => item.id === existing.id ? { ...item, scoops: item.scoops - 1 } : item)
          : current.filter((item) => item.id !== existing.id);
      }

      const selectedBeans = current.filter((item) => item.category === "beans");
      if (direction === 1) {
        if (existing) {
          if (selectedBeans.length === 1) {
            return current.map((item) => item.id === existing.id ? { ...item, scoops: item.scoops + 1 } : item);
          }
          return current.map((item) => item.category === "beans" ? { ...item, scoops: item.scoops + 0.5 } : item);
        }
        if (selectedBeans.length >= 2) {
          setFormError("A bowl can include up to two bean varieties.");
          return current;
        }
        const rate = categories.find((item) => item.id === "beans")?.pricePerScoop ?? 30;
        if (selectedBeans.length === 1) {
          return current.map((item) => item.category === "beans"
            ? { ...item, scoops: 0.5 }
            : item).concat({ id: makeId("beans"), name: itemName, category: "beans", price: rate, scoops: 0.5 });
        }
        return [...current, { id: makeId("beans"), name: itemName, category: "beans", price: rate, scoops: 1 }];
      }

      if (!existing) return current;
      if (selectedBeans.length === 1) {
        return existing.scoops > 1
          ? current.map((item) => item.id === existing.id ? { ...item, scoops: item.scoops - 1 } : item)
          : current.filter((item) => item.id !== existing.id);
      }
      if (selectedBeans.every((item) => item.scoops === 0.5)) {
        return current.filter((item) => item.id !== existing.id).map((item) =>
          item.category === "beans" ? { ...item, scoops: 1 } : item);
      }
      return current.map((item) => item.category === "beans" ? { ...item, scoops: item.scoops - 0.5 } : item);
    });
  };

  const clearDraft = () => {
    setDraftItems([]);
    setSelectedVeggies([]);
    setVeggieScoops(0);
    setEditingBowlId(null);
    setFormError("");
  };

  const saveDraftBowl = () => {
    if (draftBowlItems.length === 0) {
      setFormError("Choose a few ingredients to build your bowl first.");
      return;
    }
    if (draftBowlItems.filter((item) => item.category === "beans").length > 2) {
      setFormError("A bowl can include up to two bean varieties.");
      return;
    }
    const saved: Bowl = { id: editingBowlId ?? makeId("bowl"), items: draftBowlItems.map((item) => ({ ...item, id: makeId("item") })), total: draftTotal };
    setBowls((current) => editingBowlId
      ? current.map((bowl) => bowl.id === editingBowlId ? saved : bowl)
      : [...current, saved]);
    clearDraft();
    setFormError("");
  };

  const editBowl = (bowl: Bowl) => {
    setDraftItems(bowl.items.filter((item) => item.category !== "veggies").map((item) => ({ ...item })));
    const veggie = bowl.items.find((item) => item.category === "veggies");
    setSelectedVeggies(veggie?.veggieSelection ?? []);
    setVeggieScoops(veggie?.scoops ?? 0);
    setEditingBowlId(bowl.id);
    setFormError("");
    document.getElementById("qo-menu")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const validateCustomer = () => {
    const next: Record<string, string> = {};
    if (!form.firstName.trim()) next.firstName = "Add your first name.";
    if (!form.lastName.trim()) next.lastName = "Add your last name.";
    if (!/^[6-9]\d{9}$/.test(form.phone.trim())) next.phone = "Enter a valid 10-digit mobile number.";
    if (!form.address.trim()) next.address = "Add your flat, building and street.";
    if (!form.area) next.area = "Choose your delivery area.";
    if (bowls.length === 0 || editingBowlId) next.bowls = "Save at least one bowl before placing your order.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const placeOrder = async () => {
    setFormError("");
    if (!validateCustomer()) {
      if (!form.firstName.trim() || !form.lastName.trim() || !form.phone.trim() || !form.address.trim() || !form.area) {
        document.getElementById("qo-details")?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        document.getElementById("qo-summary")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }

    setIsPlacingOrder(true);
    try {
      const response = await fetch(API_URL + "/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: [form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(" "),
          phone: form.phone.trim(),
          address: form.address.trim(),
          area: form.area,
          city: form.city,
          // Never submit client prices. The production API validates ingredients and recalculates every amount.
          bowls: bowls.map((bowl) => ({
            items: bowl.items.map((item) => ({
              name: item.name,
              category: item.category,
              scoops: item.scoops,
              ...(item.veggieSelection ? { veggieSelection: item.veggieSelection } : {}),
            })),
          })),
        }),
      });
      const responseData = await response.json().catch(() => null);
      if (!response.ok) throw new Error(responseData?.error || responseData?.message || "We couldn't place your order. Please try again.");
      const confirmedTotal = Number(responseData?.total);
      if (!Number.isFinite(confirmedTotal) || confirmedTotal < 0) {
        throw new Error("Your order may have been received, but we couldn't read its confirmation. Please contact the kitchen before trying again.");
      }
      setPlacedOrder({
        total: confirmedTotal,
        kotNumber: typeof responseData?.kotNumber === "string" ? responseData.kotNumber : undefined,
        invoiceNumber: typeof responseData?.invoiceNumber === "string" ? responseData.invoiceNumber : undefined,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "We couldn't place your order. Please try again.");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const menuSections = categories.map((category) => ({ ...category, ...CATEGORY_META[category.id] }));
  const savedItemCount = bowls.length;

  if (placedOrder) {
    return (
      <main className="qo-page">
        <div className="qo-success-wrap">
          <div className="qo-success-card">
            <div className="qo-success-icon"><CheckCircle2 size={38} /></div>
            <span className="qo-eyebrow">THAT WAS EASY, RIGHT?</span>
            <h1>Your bowl date<br />is confirmed.</h1>
            <p>Thanks, {form.firstName}! Your order has been sent to our kitchen. We'll call you at {form.phone} if we need anything.</p>
            {placedOrder.kotNumber && <div className="qo-confirm-number">Kitchen order · {placedOrder.kotNumber}</div>}
            {placedOrder.invoiceNumber && <div className="qo-confirm-number">Order reference · {placedOrder.invoiceNumber}</div>}
            <div className="qo-confirm-total"><span>Confirmed total</span><strong>{formatMoney(placedOrder.total)}</strong></div>
            <div className="qo-success-note">Payment: Cash on delivery · Estimated delivery: 25–35 minutes, depending on your area.</div>
            <a className="qo-button qo-button-primary" href="/">Back to Underground <ArrowRight size={17} /></a>
          </div>
          <p className="qo-bottom-note">FRESHLY BUILT. UNDERGROUND APPROVED. 🥗</p>
        </div>
      </main>
    );
  }

  return (
    <main className="qo-page">
      <div className="qo-topbar">
        <a href="/" className="qo-brand-lockup" aria-label="Underground Salad Bar home">
          <span className="qo-brand-mark">USB</span>
          <span><strong>UNDERGROUND</strong><small>SALAD BAR · PUNE</small></span>
        </a>
        <span className="qo-top-note"><Sparkles size={15} /> MADE FRESH. MADE YOURS.</span>
      </div>

      <section className="qo-hero">
        <div className="qo-hero-copy">
          <span className="qo-eyebrow"><i/> THE QUICK ORDER CLUB</span>
          <h1>Your bowl.<br/><em>Your rules.</em></h1>
          <p>Skip the scroll. Build your bowl, pick your delivery spot, and we’ll take it from there.</p>
          <div className="qo-hero-pills"><span>🥬 Fresh picks</span><span>🥣 Built by you</span><span>📍 Delivered in Pune</span></div>
        </div>
        <div className="qo-hero-art" aria-hidden="true">
          <div className="qo-art-sun"/>
          <div className="qo-art-bowl"><span>🥗</span></div>
          <span className="qo-art-leaf leaf-one">✳</span><span className="qo-art-leaf leaf-two">✦</span>
          <span className="qo-art-sticker">GOOD<br/>MOOD<br/>FOOD</span>
        </div>
      </section>

      <div className="qo-step-strip">
        <span><b>01</b> Your details</span><i/>
        <span><b>02</b> Build your bowl</span><i/>
        <span><b>03</b> Order summary</span>
      </div>

      <section id="qo-details" className="qo-section">
        <div className="qo-section-heading">
          <div><span className="qo-section-number">01</span><h2>First, where to?</h2></div>
          <p>Just the essentials. We’ll handle the delicious part.</p>
        </div>
        <div className="qo-panel">
          <div className="qo-form-grid">
            <QuickOrderField label="First name *" value={form.firstName} placeholder="First name" autoComplete="given-name" maxLength={50} error={errors.firstName} onChange={(value) => updateForm("firstName", value)} />
            <QuickOrderField label="Last name *" value={form.lastName} placeholder="Last name" autoComplete="family-name" maxLength={50} error={errors.lastName} onChange={(value) => updateForm("lastName", value)} />
            <QuickOrderField label="Mobile number *" value={form.phone} placeholder="10-digit mobile number" type="tel" autoComplete="tel-national" maxLength={10} error={errors.phone} onChange={(value) => updateForm("phone", value.replace(/\D/g, "").slice(0, 10))} />
            <div className="qo-field qo-city-field"><span>City</span><div>Pune <small>Currently delivering across Pune</small></div></div>
            <label className="qo-field qo-address-field">
              <span>Flat / building / street *</span>
              <textarea rows={2} maxLength={500} placeholder="Flat, building, street and landmark" value={form.address} onChange={(event) => updateForm("address", event.target.value)} aria-invalid={Boolean(errors.address)}/>
              {errors.address && <small className="qo-field-error">{errors.address}</small>}
            </label>
            <label className="qo-field">
              <span>Delivery area *</span>
              <select value={form.area} onChange={(event) => updateForm("area", event.target.value)} aria-invalid={Boolean(errors.area)}>
                <option value="">Choose your area</option>
                {DELIVERY_AREAS.map((area) => <option key={area.name} value={area.name}>{area.name}</option>)}
              </select>
              {errors.area && <small className="qo-field-error">{errors.area}</small>}
            </label>
          </div>
          <p className="qo-form-footnote"><Check size={14}/> Your details are only used to prepare and deliver this order.</p>
        </div>
      </section>

      <section id="qo-menu" className="qo-section">
        <div className="qo-section-heading">
          <div><span className="qo-section-number">02</span><h2>Let’s build something good.</h2></div>
          <p>Pick your ingredients. Every scoop adds to your bowl.</p>
        </div>
        <div className="qo-menu-intro">
          <div><strong>{editingBowlId ? "Editing your bowl" : "The build-your-own menu"}</strong><span>Fresh combinations, made your way.</span></div>
          <span className="qo-price-note">Live price estimate · final price confirmed at checkout</span>
        </div>

        <div className="qo-menu-groups">
          {menuSections.map((category, index) => (
            <section className="qo-category-panel" key={category.id}>
              <div className="qo-category-heading">
                <div className="qo-category-icon">{category.icon}</div>
                <div><span>STEP {String(index + 1).padStart(2, "0")}</span><h3>{category.name}</h3><p>{category.helper}</p></div>
                <strong>{formatMoney(category.pricePerScoop)}<small> / scoop</small></strong>
              </div>

              {category.id === "veggies" ? (
                <>
                  <div className="qo-veggie-grid">
                    {category.items.map((item) => {
                      const active = selectedVeggies.includes(item);
                      return <button type="button" key={item} className={"qo-veggie-chip " + (active ? "is-selected" : "")} onClick={() => changeIngredient(category.id, item, active ? -1 : 1)} aria-pressed={active}>
                        <span className="qo-chip-check">{active ? <Check size={14}/> : <Plus size={14}/>}</span>{item}
                      </button>;
                    })}
                  </div>
                  {selectedVeggies.length > 0 && <div className="qo-veggie-scoop-row"><span>{selectedVeggies.length} veggie varieties picked</span><div><button type="button" onClick={() => setVeggieScoops((value) => Math.max(1, value - 1))} aria-label="Remove veggie scoop"><Minus size={14}/></button><strong>{veggieScoops} scoop{veggieScoops !== 1 ? "s" : ""}</strong><button type="button" onClick={() => setVeggieScoops((value) => Math.min(10, value + 1))} aria-label="Add veggie scoop"><Plus size={14}/></button></div></div>}
                </>
              ) : (
                <div className="qo-ingredient-grid">
                  {category.items.map((item) => {
                    const selection = draftItems.find((selected) => selected.category === category.id && selected.name === item);
                    const quantity = selection?.scoops ?? 0;
                    const beanLimit = category.id === "beans" && !selection && draftItems.filter((selected) => selected.category === "beans").length >= 2;
                    return <article className={"qo-ingredient-card " + (quantity > 0 ? "is-selected" : "")} key={item}>
                      <div className="qo-ingredient-name"><span>{item}</span>{quantity > 0 && <i><Check size={12}/></i>}</div>
                      <div className="qo-ingredient-bottom"><small>{formatMoney(category.pricePerScoop)} <em>/ scoop</em></small>
                        {quantity > 0 ? <div className="qo-quantity-control">
                          <button type="button" onClick={() => changeIngredient(category.id, item, -1)} aria-label={"Remove " + item}><Minus size={13}/></button>
                          <b>{quantity}</b>
                          <button type="button" onClick={() => changeIngredient(category.id, item, 1)} aria-label={"Add " + item}><Plus size={13}/></button>
                        </div> : <button type="button" className="qo-add-button" disabled={beanLimit} onClick={() => changeIngredient(category.id, item, 1)}><Plus size={14}/> Add</button>}
                      </div>
                    </article>;
                  })}
                </div>
              )}
              {category.id === "beans" && <p className="qo-category-footnote">Choose up to two bean varieties. When you pick two, the first scoop is split evenly.</p>}
              {category.id === "veggies" && <p className="qo-category-footnote">Your selected varieties are mixed together in one veggie scoop. Add extra scoops if you’re feeling hungry.</p>}
            </section>
          ))}
        </div>

        <div className="qo-draft-footer">
          <div><span>THIS BOWL’S ESTIMATE</span><strong>{formatMoney(draftTotal)}</strong><small>{draftBowlItems.length} ingredient line{draftBowlItems.length !== 1 ? "s" : ""} selected</small></div>
          <div className="qo-draft-actions">
            {editingBowlId && <button type="button" className="qo-button qo-button-ghost" onClick={clearDraft}>Cancel edit</button>}
            <button type="button" className="qo-button qo-button-primary" onClick={saveDraftBowl} disabled={draftBowlItems.length === 0}>{editingBowlId ? "Save bowl changes" : "Add this bowl"} <Plus size={16}/></button>
          </div>
        </div>
        {formError && <p className="qo-form-error" role="alert">{formError}</p>}
        {bowls.length > 0 && <div className="qo-saved-bowls">
          <div className="qo-saved-heading"><div><span>YOUR ORDER SO FAR</span><h3>{bowls.length} bowl{bowls.length !== 1 ? "s" : ""} in the making</h3></div><button type="button" className="qo-add-another" onClick={clearDraft}><Plus size={15}/> Start another bowl</button></div>
          <div className="qo-bowl-list">
            {bowls.map((bowl, index) => <article className="qo-bowl-card" key={bowl.id}>
              <div className="qo-bowl-card-top"><div><span>🥣 BOWL {index + 1}</span><strong>{formatMoney(bowl.total)}</strong></div><div><button type="button" onClick={() => editBowl(bowl)}>Edit</button><button type="button" aria-label={"Remove bowl " + (index + 1)} onClick={() => setBowls((current) => current.filter((item) => item.id !== bowl.id))}><Trash2 size={15}/></button></div></div>
              <p>{bowl.items.map((item) => item.category === "veggies" ? item.veggieSelection?.join(", ") + " · " + item.scoops + " veggie scoop" + (item.scoops !== 1 ? "s" : "") : item.name + (item.scoops !== 1 ? " × " + item.scoops : "")).join(" · ")}</p>
            </article>)}
          </div>
        </div>}
        {errors.bowls && <p className="qo-field-error qo-bowl-error">{errors.bowls}</p>}
      </section>

      <section id="qo-summary" className="qo-section qo-summary-section">
        <div className="qo-section-heading">
          <div><span className="qo-section-number">03</span><h2>The happy total.</h2></div>
          <p>A clear little breakdown before it heads to our kitchen.</p>
        </div>
        <div className="qo-summary-panel">
          <div className="qo-summary-main">
            <div className="qo-summary-row"><span>Your bowls ({bowls.length})</span><strong>{formatMoney(bowlSubtotal)}</strong></div>
            <div className="qo-summary-row"><span>Delivery {form.area ? "· " + form.area : ""}</span><strong>{form.area ? (deliveryCharge === 0 ? "FREE" : formatMoney(deliveryCharge)) : "Choose area"}</strong></div>
            <div className="qo-summary-total"><span>Estimated total</span><strong>{formatMoney(estimatedTotal)}</strong></div>
            <p className="qo-summary-disclaimer">No online payment required. Payment is collected on delivery. Final ingredient and delivery pricing is confirmed by our ordering system.</p>
          </div>
          <div className="qo-summary-side">
            <span>YOUR KITCHEN NOTE</span>
            <div>🥗</div>
            <strong>Freshly made.<br/>Never boring.</strong>
            <small>We’ll get your bowls started once you place the order.</small>
          </div>
        </div>
      </section>

      <div className="qo-submit-error" aria-live="polite">{formError}</div>
      <footer className="qo-footer">
        <div><strong>UNDERGROUND SALAD BAR</strong><span>Fresh bowls. Pune roots. Good energy.</span></div>
        <span>Made with 🥬 in Pune</span>
      </footer>

      <div className="qo-sticky-order">
        <div><span>{savedItemCount} bowl{savedItemCount !== 1 ? "s" : ""} saved</span><strong>{formatMoney(estimatedTotal)}</strong></div>
        <button type="button" onClick={placeOrder} disabled={isPlacingOrder || bowls.length === 0 || Boolean(editingBowlId)}>
          {isPlacingOrder ? "Sending to the kitchen…" : "Place order"} <ArrowRight size={17}/>
        </button>
      </div>
    </main>
  );
}
