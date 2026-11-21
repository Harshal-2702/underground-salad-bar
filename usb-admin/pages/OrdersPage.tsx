import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { API_URL } from "../src/config.ts";
import "../src/orders.css";

type OrderStatus = "PENDING" | "CONFIRMED" | "PREPARING" | "READY" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";
type OrderChannel = "WEBSITE" | "ZOMATO" | "SWIGGY";
type OrderStatusFilter = "NEW" | "ACCEPTED" | "READY" | "HANDED_OVER" | "CANCELLED";
type DatePreset = "TODAY" | "YESTERDAY" | "CUSTOM";
type KotTimerSeverity = "NEUTRAL" | "AMBER" | "LATE" | "UNCONFIGURED";
type KotTimingField = "acceptanceAmberMinutes" | "acceptanceLateMinutes" | "preparationAmberMinutes" | "preparationLateMinutes";
type View = "orders" | "designer";

type OrderBowl = {
  id: string;
  bowlName: string;
  quantity: number;
  price: number;
  details: string | null;
};

type OrderStatusEvent = {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorEmail: string | null;
  createdAt: string;
};

type OrderRecord = {
  id: string;
  invoiceNumber: string;
  kotNumber: string;
  channel: OrderChannel;
  externalOrderId: string | null;
  status: OrderStatus;
  acceptedAt: string | null;
  readyAt: string | null;
  handedOverAt: string | null;
  cancelledAt: string | null;
  acceptanceDurationSeconds: number | null;
  preparationDurationSeconds: number | null;
  total: number;
  deliveryCharge: number | null;
  paymentMethod: string;
  createdAt: string;
  deliveryName: string | null;
  deliveryPhone: string | null;
  deliveryAddress: string | null;
  deliveryArea: string | null;
  deliveryCity: string | null;
  specialInstructions: string | null;
  customer: { name: string; phone: string; address: string; area: string; city: string } | null;
  bowls: OrderBowl[];
  statusEvents: OrderStatusEvent[];
};

type OrdersResponse = {
  items: OrderRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  selectedDate: string;
  statusCounts: Record<OrderStatus, number>;
  channelCounts: Record<OrderChannel, number>;
};

type KotTemplateType = "KITCHEN" | "CUSTOMER";
type KotSectionId = "order" | "customer" | "items" | "totals" | "special" | "footer";

type KotTemplateConfig = {
  paperWidth: "58mm" | "80mm";
  headerText: string;
  footerText: string;
  showBrandName: boolean;
  showLogo: boolean;
  showKotNumber: true;
  showChannel: true;
  showReceivedAt: true;
  showExternalOrderReference: boolean;
  showInvoiceNumber: boolean;
  showCustomerFirstName: boolean;
  showCustomerPhone: boolean;
  showDeliveryAddress: boolean;
  showItems: true;
  showIngredients: boolean;
  showItemPrices: boolean;
  showSubtotal: boolean;
  showDeliveryCharge: boolean;
  showTotal: boolean;
  showPaymentMethod: boolean;
  showSpecialInstructions: true;
  sectionOrder: KotSectionId[];
  fontSize: number;
  headingWeight: "normal" | "bold";
  lineSpacing: "compact" | "normal" | "relaxed";
  margin: "narrow" | "normal" | "wide";
  alignment: "left" | "center";
};

type KotChannelTimingSetting = {
  channel: OrderChannel;
  acceptanceAmberMinutes: number | null;
  acceptanceLateMinutes: number | null;
  preparationAmberMinutes: number | null;
  preparationLateMinutes: number | null;
  updatedByEmail?: string | null;
  updatedAt?: string;
};

type KotTemplateResponse = {
  template: { code: string; name: string };
  current: { versionNumber: number; config: KotTemplateConfig; isActive: boolean; createdAt: string | null };
  history: Array<{ id: string; versionNumber: number; isActive: boolean; createdAt: string; createdByEmail: string | null }>;
};

const DEFAULT_SECTION_ORDER: KotSectionId[] = ["order", "customer", "items", "totals", "special", "footer"];

const DEFAULT_KITCHEN_TEMPLATE: KotTemplateConfig = {
  paperWidth: "80mm",
  headerText: "UNDERGROUND KITCHEN",
  footerText: "",
  showBrandName: true,
  showLogo: false,
  showKotNumber: true,
  showChannel: true,
  showReceivedAt: true,
  showExternalOrderReference: true,
  showInvoiceNumber: false,
  showCustomerFirstName: true,
  showCustomerPhone: false,
  showDeliveryAddress: false,
  showItems: true,
  showIngredients: true,
  showItemPrices: false,
  showSubtotal: false,
  showDeliveryCharge: false,
  showTotal: false,
  showPaymentMethod: false,
  showSpecialInstructions: true,
  sectionOrder: [...DEFAULT_SECTION_ORDER],
  fontSize: 12,
  headingWeight: "bold",
  lineSpacing: "normal",
  margin: "normal",
  alignment: "left",
};

const DEFAULT_CUSTOMER_TEMPLATE: KotTemplateConfig = {
  ...DEFAULT_KITCHEN_TEMPLATE,
  headerText: "UNDERGROUND SALAD BAR",
  footerText: "Thank you for ordering!",
  showInvoiceNumber: true,
  showCustomerPhone: true,
  showDeliveryAddress: true,
  showItemPrices: true,
  showSubtotal: true,
  showDeliveryCharge: true,
  showTotal: true,
  showPaymentMethod: true,
};

function defaultTemplate(type: KotTemplateType): KotTemplateConfig {
  return type === "CUSTOMER" ? DEFAULT_CUSTOMER_TEMPLATE : DEFAULT_KITCHEN_TEMPLATE;
}

const KOT_SECTION_LABELS: Record<KotSectionId, string> = {
  order: "Order reference",
  customer: "Customer details",
  items: "Ordered bowls & ingredients",
  totals: "Pricing & payment",
  special: "Special instructions",
  footer: "Footer message",
};

const STATUS_OPTIONS: Array<{ value: "ALL" | OrderStatusFilter; label: string }> = [
  { value: "ALL", label: "All statuses" },
  { value: "NEW", label: "New" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "READY", label: "Ready" },
  { value: "HANDED_OVER", label: "Handed over" },
  { value: "CANCELLED", label: "Cancelled" },
];

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

function shiftDate(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function customerDetails(order: OrderRecord) {
  return {
    name: order.deliveryName ?? order.customer?.name ?? "Guest",
    phone: order.deliveryPhone ?? order.customer?.phone ?? "—",
    address: order.deliveryAddress ?? order.customer?.address ?? "—",
    area: order.deliveryArea ?? order.customer?.area ?? "—",
    city: order.deliveryCity ?? order.customer?.city ?? "—",
  };
}

function statusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    PENDING: "New",
    CONFIRMED: "Accepted",
    PREPARING: "Accepted",
    READY: "Ready",
    OUT_FOR_DELIVERY: "Handed over",
    DELIVERED: "Completed",
    CANCELLED: "Cancelled",
  };
  return labels[status];
}

function channelLabel(channel: OrderChannel): string {
  return channel === "WEBSITE" ? "Website" : channel === "ZOMATO" ? "Zomato" : "Swiggy";
}

function timeLabel(value: string): string {
  return new Date(value).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dateTimeLabel(value: string): string {
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function timerSeverity(elapsedSeconds: number, amberMinutes: number | null, lateMinutes: number | null): KotTimerSeverity {
  if (amberMinutes === null || lateMinutes === null) return "UNCONFIGURED";
  if (elapsedSeconds >= lateMinutes * 60) return "LATE";
  if (elapsedSeconds >= amberMinutes * 60) return "AMBER";
  return "NEUTRAL";
}

function getOrderTimer(order: OrderRecord, now: number, settings: KotChannelTimingSetting[]) {
  const channelSettings = settings.find((item) => item.channel === order.channel);
  const currentElapsed = (start: string | null) => start
    ? Math.max(0, Math.floor((now - new Date(start).getTime()) / 1000))
    : null;

  if (order.status === "PENDING") {
    const elapsed = currentElapsed(order.createdAt) ?? 0;
    return {
      label: "TIME TO ACCEPT",
      value: formatDuration(elapsed),
      severity: channelSettings
        ? timerSeverity(elapsed, channelSettings.acceptanceAmberMinutes, channelSettings.acceptanceLateMinutes)
        : "UNCONFIGURED" as KotTimerSeverity,
      helper: channelSettings?.acceptanceAmberMinutes == null ? "Acceptance SLA not configured" : "Acceptance timer",
    };
  }

  if (order.status === "CONFIRMED" || order.status === "PREPARING") {
    if (!order.acceptedAt) {
      return { label: "PREPARATION", value: "—", severity: "UNCONFIGURED" as KotTimerSeverity, helper: "Timing unavailable for this older order" };
    }
    const elapsed = currentElapsed(order.acceptedAt) ?? 0;
    return {
      label: "TIME TO READY",
      value: formatDuration(elapsed),
      severity: channelSettings
        ? timerSeverity(elapsed, channelSettings.preparationAmberMinutes, channelSettings.preparationLateMinutes)
        : "UNCONFIGURED" as KotTimerSeverity,
      helper: channelSettings?.preparationAmberMinutes == null ? "Preparation SLA not configured" : "Preparation timer",
    };
  }

  if (order.preparationDurationSeconds !== null) {
    const elapsed = order.preparationDurationSeconds;
    return {
      label: order.status === "CANCELLED" ? "PREP BEFORE CANCEL" : "READY IN",
      value: formatDuration(elapsed),
      severity: channelSettings
        ? timerSeverity(elapsed, channelSettings.preparationAmberMinutes, channelSettings.preparationLateMinutes)
        : "UNCONFIGURED" as KotTimerSeverity,
      helper: "Preparation time saved",
    };
  }

  if (order.status === "CANCELLED" && order.cancelledAt && !order.acceptedAt) {
    const elapsed = Math.max(0, Math.floor((new Date(order.cancelledAt).getTime() - new Date(order.createdAt).getTime()) / 1000));
    return {
      label: "CANCELLED BEFORE ACCEPT",
      value: formatDuration(elapsed),
      severity: channelSettings
        ? timerSeverity(elapsed, channelSettings.acceptanceAmberMinutes, channelSettings.acceptanceLateMinutes)
        : "UNCONFIGURED" as KotTimerSeverity,
      helper: channelSettings?.acceptanceAmberMinutes == null ? "Acceptance SLA not configured" : "Acceptance time saved at cancellation",
    };
  }

  return { label: "STAGE TIME", value: "—", severity: "UNCONFIGURED" as KotTimerSeverity, helper: "No complete timing record" };
}


function escapePrintText(value: string): string {
  const replacements: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (character) => replacements[character] ?? character);
}

function buildKotTicketMarkup(order: OrderRecord, config: KotTemplateConfig, type: KotTemplateType): string {
  const details = customerDetails(order);
  const customerName = details.name.trim() || "Guest";
  const deliveryCharge = Math.max(0, Number(order.deliveryCharge ?? 0));
  const itemsSubtotal = order.bowls.reduce((sum, bowl) => sum + Number(bowl.price || 0), 0);
  const money = (amount: number) => `₹${amount.toFixed(2)}`;
  const brand = config.showBrandName && config.headerText.trim()
    ? `<div class="brand">${escapePrintText(config.headerText.trim())}</div>`
    : "";
  const itemRows = order.bowls.map((bowl) => {
    const itemDetails = config.showIngredients && bowl.details
      ? `<div class="details">${escapePrintText(bowl.details).replace(/\r?\n/g, "<br>")}</div>`
      : "";
    const price = type === "CUSTOMER" && config.showItemPrices
      ? `<div class="price">${money(Number(bowl.price || 0))}</div>`
      : "";
    return `<section class="item">
      <div class="item-row"><strong>${escapePrintText(String(bowl.quantity))} × ${escapePrintText(bowl.bowlName)}</strong>${price}</div>
      ${itemDetails}
    </section>`;
  }).join("");
  const sections: Record<KotSectionId, string> = {
    order: [
      brand,
      `<div class="copy-kind">${type === "CUSTOMER" ? "CUSTOMER COPY" : "KITCHEN COPY"}</div>`,
      `<div class="kot">${escapePrintText(order.kotNumber)}</div>`,
      `<div class="meta"><strong>Source:</strong> ${escapePrintText(channelLabel(order.channel))}</div>`,
      `<div class="meta"><strong>Received:</strong> ${escapePrintText(dateTimeLabel(order.createdAt))}</div>`,
      config.showExternalOrderReference && order.externalOrderId ? `<div class="meta">External ref: ${escapePrintText(order.externalOrderId)}</div>` : "",
      type === "CUSTOMER" && config.showInvoiceNumber ? `<div class="meta">Invoice: ${escapePrintText(order.invoiceNumber)}</div>` : "",
    ].filter(Boolean).join(""),
    customer: [
      config.showCustomerFirstName ? `<div class="customer-name">Customer: ${escapePrintText(customerName)}</div>` : "",
      type === "CUSTOMER" && config.showCustomerPhone ? `<div class="meta">Phone: ${escapePrintText(details.phone)}</div>` : "",
      type === "CUSTOMER" && config.showDeliveryAddress ? `<div class="meta">Delivery: ${escapePrintText([details.address, details.area, details.city].filter((part) => part && part !== "—").join(", "))}</div>` : "",
    ].filter(Boolean).join(""),
    items: `<div class="items">${itemRows || "<div>No items</div>"}</div>`,
    totals: type === "CUSTOMER" ? [
      config.showSubtotal ? `<div class="total-row"><span>Items subtotal</span><strong>${money(itemsSubtotal)}</strong></div>` : "",
      config.showDeliveryCharge ? `<div class="total-row"><span>Delivery</span><strong>${deliveryCharge === 0 ? "FREE" : money(deliveryCharge)}</strong></div>` : "",
      config.showTotal ? `<div class="grand-total"><span>AMOUNT PAYABLE</span><strong>${money(order.total)}</strong></div>` : "",
      config.showPaymentMethod ? `<div class="meta">Payment: ${escapePrintText(order.paymentMethod)}</div>` : "",
    ].filter(Boolean).join("") : "",
    special: order.specialInstructions?.trim()
      ? `<section class="special"><strong>Special instructions</strong><div>${escapePrintText(order.specialInstructions).replace(/\r?\n/g, "<br>")}</div></section>`
      : "",
    footer: config.footerText.trim() ? `<div class="footer">${escapePrintText(config.footerText.trim())}</div>` : "",
  };

  return config.sectionOrder.map((section, index) => {
    const html = sections[section];
    if (!html) return "";
    return `${index > 0 ? '<div class="rule"></div>' : ""}${html}`;
  }).join("");
}

function buildKotPrintHtml(order: OrderRecord, config: KotTemplateConfig, type: KotTemplateType): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapePrintText(order.kotNumber)} · ${type === "CUSTOMER" ? "Customer copy" : "Kitchen copy"}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body { width: 80mm; font-family: Arial, Helvetica, sans-serif; font-size: ${config.fontSize}px; line-height: ${config.lineSpacing === "compact" ? 1.15 : config.lineSpacing === "relaxed" ? 1.65 : 1.35}; }
  .kot-ticket { width: ${config.paperWidth === "80mm" ? "72mm" : "48mm"}; padding: ${config.margin === "narrow" ? "1mm" : config.margin === "wide" ? "4mm" : "2mm"}; margin: 0 auto; font-weight: ${config.headingWeight === "bold" ? 400 : 400}; text-align: ${config.alignment}; overflow-wrap: anywhere; }
  .brand { text-align: center; font-size: 1.15em; font-weight: 900; margin-bottom: 3mm; }
  .copy-kind { text-align: center; font-size: .72em; font-weight: 800; letter-spacing: .8px; margin-bottom: 1mm; }
  .kot { text-align: center; font-size: 1.55em; font-weight: 900; letter-spacing: .3px; margin-bottom: 1mm; }
  .customer-name { font-size: 1.12em; font-weight: 800; margin: 1mm 0; }
  .meta { font-size: .9em; margin: .7mm 0; overflow-wrap: anywhere; }
  .rule { border-top: 1px dashed #000; margin: 2.2mm 0; }
  .item { padding: 1.4mm 0; border-bottom: 1px dashed #999; break-inside: avoid; }
  .item-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 3mm; font-size: 1.06em; }
  .item-row strong { font-weight: 850; overflow-wrap: anywhere; }
  .price { white-space: nowrap; font-weight: 750; }
  .details { margin-top: 1mm; padding-left: 2mm; font-size: .92em; overflow-wrap: anywhere; }
  .total-row { display: flex; justify-content: space-between; gap: 8px; padding: 1mm 0; font-size: .95em; }
  .grand-total { display: flex; justify-content: space-between; gap: 8px; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 2.2mm 0; margin: 2mm 0; font-weight: 900; font-size: 1.12em; }
  .special { margin-top: 2.5mm; padding: 2mm; border: 1px solid #000; font-size: .96em; overflow-wrap: anywhere; }
  .special strong { display: block; text-transform: uppercase; margin-bottom: 1mm; }
  .footer { text-align: center; border-top: 1px dashed #000; margin-top: 3mm; padding-top: 2mm; font-size: .85em; overflow-wrap: anywhere; }
  @media screen { body { margin: 8px auto; } .kot-ticket { outline: 1px dashed #bbb; } }
</style></head><body><main class="kot-ticket">${buildKotTicketMarkup(order, config, type)}</main></body></html>`;
}

function buildBothKotPrintHtml(
  order: OrderRecord,
  customerConfig: KotTemplateConfig,
  kitchenConfig: KotTemplateConfig,
): string {
  const customerTicket = buildKotTicketMarkup(order, customerConfig, "CUSTOMER");
  const kitchenTicket = buildKotTicketMarkup(order, kitchenConfig, "KITCHEN");
  const pageStyle = (config: KotTemplateConfig) => `width:${config.paperWidth === "80mm" ? "72mm" : "48mm"};padding:${config.margin === "narrow" ? "1mm" : config.margin === "wide" ? "4mm" : "2mm"};font-size:${config.fontSize}px;line-height:${config.lineSpacing === "compact" ? 1.15 : config.lineSpacing === "relaxed" ? 1.65 : 1.35};text-align:${config.alignment};`;
  const sharedStyles = `
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:#fff;color:#000}
    body{width:80mm;font-family:Arial,Helvetica,sans-serif}
    .kot-ticket{margin:0 auto;overflow-wrap:anywhere;page-break-after:always;break-after:page}
    .kot-ticket:last-child{page-break-after:auto;break-after:auto}
    .brand{text-align:center;font-size:1.15em;font-weight:900;margin-bottom:3mm}
    .copy-kind{text-align:center;font-size:.72em;font-weight:800;letter-spacing:.8px;margin-bottom:1mm}
    .kot{text-align:center;font-size:1.55em;font-weight:900;letter-spacing:.3px;margin-bottom:1mm}
    .customer-name{font-size:1.12em;font-weight:800;margin:1mm 0}
    .meta{font-size:.9em;margin:.7mm 0;overflow-wrap:anywhere}
    .rule{border-top:1px dashed #000;margin:2.2mm 0}
    .item{padding:1.4mm 0;border-bottom:1px dashed #999;break-inside:avoid}
    .item-row{display:flex;justify-content:space-between;align-items:flex-start;gap:3mm;font-size:1.06em}
    .item-row strong{font-weight:850;overflow-wrap:anywhere}
    .price{white-space:nowrap;font-weight:750}
    .details{margin-top:1mm;padding-left:2mm;font-size:.92em;overflow-wrap:anywhere}
    .total-row{display:flex;justify-content:space-between;gap:8px;padding:1mm 0;font-size:.95em}
    .grand-total{display:flex;justify-content:space-between;gap:8px;border-top:1px solid #000;border-bottom:1px solid #000;padding:2.2mm 0;margin:2mm 0;font-weight:900;font-size:1.12em}
    .special{margin-top:2.5mm;padding:2mm;border:1px solid #000;font-size:.96em;overflow-wrap:anywhere}
    .special strong{display:block;text-transform:uppercase;margin-bottom:1mm}
    .footer{text-align:center;border-top:1px dashed #000;margin-top:3mm;padding-top:2mm;font-size:.85em;overflow-wrap:anywhere}
    @media screen{body{margin:8px auto}.kot-ticket{outline:1px dashed #bbb}}
  `;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapePrintText(order.kotNumber)} · Customer + Kitchen copies</title><style>@page{size:80mm auto;margin:0}${sharedStyles}</style></head><body>
    <main class="kot-ticket" style="${pageStyle(customerConfig)}">${customerTicket}</main>
    <main class="kot-ticket" style="${pageStyle(kitchenConfig)}">${kitchenTicket}</main>
  </body></html>`;
}

function sampleKotOrder(): OrderRecord {
  return {
    id: "sample-kot",
    invoiceNumber: "TEST-KOT",
    kotNumber: "KOT-TEST-001",
    channel: "WEBSITE",
    externalOrderId: null,
    status: "CONFIRMED",
    acceptedAt: null,
    readyAt: null,
    handedOverAt: null,
    cancelledAt: null,
    acceptanceDurationSeconds: null,
    preparationDurationSeconds: null,
    total: 570,
    deliveryCharge: 50,
    paymentMethod: "COD",
    createdAt: new Date().toISOString(),
    deliveryName: "Sample Customer",
    deliveryPhone: "9876543210",
    deliveryAddress: "Flat 4B, Green Tower, MG Road",
    deliveryArea: "Aundh",
    deliveryCity: "Pune",
    specialInstructions: "Please keep the dressing separate.",
    customer: null,
    bowls: [{
      id: "sample-bowl",
      bowlName: "Continental Bowl",
      quantity: 2,
      price: 520,
      details: ["BASE: Rice", "PROTEIN: Grilled chicken", "VEGGIES: Roasted vegetables", "DRESSING: Pesto"].join("\n"),
    }],
    statusEvents: [],
  };
}

function timingDefault(): KotChannelTimingSetting[] {
  return (["WEBSITE", "ZOMATO", "SWIGGY"] as OrderChannel[]).map((channel) => ({
    channel,
    acceptanceAmberMinutes: null,
    acceptanceLateMinutes: null,
    preparationAmberMinutes: null,
    preparationLateMinutes: null,
  }));
}

function ApiError({ children }: { children: ReactNode }) {
  return <div className="kot-alert kot-alert-error" role="alert">{children}</div>;
}

type OrdersPageProps = {
  accessToken: string;
  signedInEmail: string;
  onSignOut: () => Promise<void>;
  onOpenIngredients: () => void;
  onOpenRecipes: () => void;
  onOpenPurchases: () => void;
};

export default function OrdersPage({
  accessToken,
  signedInEmail,
  onSignOut,
  onOpenIngredients,
  onOpenRecipes,
  onOpenPurchases,
}: OrdersPageProps) {
  const [view, setView] = useState<View>("orders");
  const [ordersData, setOrdersData] = useState<OrdersResponse | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | OrderStatusFilter>("ALL");
  const [channelFilter, setChannelFilter] = useState<"ALL" | OrderChannel>("ALL");
  const [datePreset, setDatePreset] = useState<DatePreset>("TODAY");
  const [customDate, setCustomDate] = useState(indiaDateKey());
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [apiError, setApiError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyOrder, setBusyOrder] = useState(false);
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
  const [printError, setPrintError] = useState("");
  const [printNotice, setPrintNotice] = useState("");
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(() => {
    try {
      return window.localStorage.getItem("ukos.kot.autoPrintEnabled.v1") === "true";
    } catch {
      return false;
    }
  });
  const [autoPrintNotice, setAutoPrintNotice] = useState("");
  const autoPrintedKotIdsRef = useRef<Set<string>>((() => {
    try {
      const raw = window.localStorage.getItem("ukos.kot.autoPrintedIds.v1");
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []);
    } catch {
      return new Set<string>();
    }
  })());
  const autoPrintingKotIdsRef = useRef<Set<string>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const audioContextRef = useRef<AudioContext | null>(null);
  const previousIds = useRef<Set<string> | null>(null);
  const selectedOrderIdRef = useRef<string | null>(null);
  const loadingRef = useRef(false);

  const [activeTemplateType, setActiveTemplateType] = useState<KotTemplateType>("KITCHEN");
  const [templateDataByType, setTemplateDataByType] = useState<Record<KotTemplateType, KotTemplateResponse | null>>({ KITCHEN: null, CUSTOMER: null });
  const [templateConfigs, setTemplateConfigs] = useState<Record<KotTemplateType, KotTemplateConfig>>({
    KITCHEN: DEFAULT_KITCHEN_TEMPLATE,
    CUSTOMER: DEFAULT_CUSTOMER_TEMPLATE,
  });
  const [draggedSection, setDraggedSection] = useState<KotSectionId | null>(null);
  const [dragOverSection, setDragOverSection] = useState<KotSectionId | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateError, setTemplateError] = useState("");
  const [templateNotice, setTemplateNotice] = useState("");

  const templateData = templateDataByType[activeTemplateType];
  const templateConfig = templateConfigs[activeTemplateType];
  const setTemplateConfig = (updater: KotTemplateConfig | ((current: KotTemplateConfig) => KotTemplateConfig)) => {
    setTemplateConfigs((current) => ({
      ...current,
      [activeTemplateType]: typeof updater === "function" ? updater(current[activeTemplateType]) : updater,
    }));
  };
  // Persisted settings drive live timer colours. Draft settings only change after Save.
  const [timingSettings, setTimingSettings] = useState<KotChannelTimingSetting[]>(timingDefault());
  const [timingSettingsDraft, setTimingSettingsDraft] = useState<KotChannelTimingSetting[]>(timingDefault());
  const [timingSettingsOpen, setTimingSettingsOpen] = useState(false);
  const timingPopoverRef = useRef<HTMLDivElement | null>(null);
  const [timingSettingsLoading, setTimingSettingsLoading] = useState(false);
  const [timingSettingsSaving, setTimingSettingsSaving] = useState(false);
  const [timingSettingsError, setTimingSettingsError] = useState("");
  const [timingSettingsNotice, setTimingSettingsNotice] = useState("");

  useEffect(() => { selectedOrderIdRef.current = selectedOrder?.id ?? null; }, [selectedOrder]);

  useEffect(() => {
    const interval = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedOrder) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedOrder(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedOrder]);

  const handleSoundToggle = (enabled: boolean) => {
    setSoundEnabled(enabled);
    if (enabled && typeof window !== "undefined" && window.AudioContext) {
      if (!audioContextRef.current) audioContextRef.current = new window.AudioContext();
      void audioContextRef.current.resume().catch(() => undefined);
    }
  };

  useEffect(() => () => {
    if (audioContextRef.current) void audioContextRef.current.close().catch(() => undefined);
  }, []);

  const selectedDate = useMemo(() => {
    if (datePreset === "YESTERDAY") return shiftDate(indiaDateKey(), -1);
    if (datePreset === "CUSTOM") return customDate;
    return indiaDateKey();
  }, [datePreset, customDate]);

  const loadOrders = useCallback(async (isRefresh = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams({
        date: selectedDate,
        channel: channelFilter,
        status: statusFilter,
        search: search.trim(),
        page: String(page),
        pageSize: "50",
      });
      const response = await fetch(`${API_URL}/orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.status === 401) {
        setApiError("Your session expired. Please sign in again.");
        await onSignOut();
        return;
      }
      if (response.status === 403) {
        setApiError("This account is not authorised for kitchen access.");
        return;
      }
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload && typeof payload.error === "string" ? payload.error : `Order request failed (${response.status}).`;
        throw new Error(message);
      }
      if (!payload || !Array.isArray(payload.items)) {
        throw new Error("The server returned an unexpected kitchen order response.");
      }

      const nextOrders = payload as OrdersResponse;
      const nextIds = new Set(nextOrders.items.map((order) => order.id));
      if (previousIds.current && soundEnabled) {
        const hasNew = nextOrders.items.some((order) => !previousIds.current?.has(order.id));
        if (hasNew && audioContextRef.current?.state === "running") {
          const context = audioContextRef.current;
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(880, context.currentTime);
          oscillator.frequency.setValueAtTime(660, context.currentTime + 0.12);
          gain.gain.setValueAtTime(0.0001, context.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.3);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start();
          oscillator.stop(context.currentTime + 0.32);
        }
      }
      if (previousIds.current) {
        previousIds.current = new Set([...previousIds.current, ...nextIds]);
      } else {
        previousIds.current = nextIds;
      }
      setOrdersData(nextOrders);
      setLastRefreshedAt(new Date());
      if (selectedOrderIdRef.current) {
        const refreshed = nextOrders.items.find((order) => order.id === selectedOrderIdRef.current);
        // Close the details drawer if the order no longer matches the active filters
        // (for example, after accepting an order while viewing only NEW orders).
        setSelectedOrder(refreshed ?? null);
      }
      setApiError("");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Unable to load kitchen orders.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, channelFilter, statusFilter, search, page, selectedDate, onSignOut, soundEnabled]);

  useEffect(() => {
    void loadOrders(false);
    const interval = window.setInterval(() => void loadOrders(true), 5000);
    return () => window.clearInterval(interval);
  }, [loadOrders]);

  const loadTemplate = useCallback(async () => {
    setTemplateLoading(true);
    setTemplateError("");
    try {
      const types: KotTemplateType[] = ["KITCHEN", "CUSTOMER"];
      const loaded = await Promise.all(types.map(async (type) => {
        const response = await fetch(`${API_URL}/kot/templates?type=${type}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const payload = await response.json().catch(() => null);
        if (response.status === 401) {
          await onSignOut();
          throw new Error("Your session expired. Please sign in again.");
        }
        if (!response.ok) {
          throw new Error(payload && typeof payload.error === "string" ? payload.error : `${type.toLowerCase()} template request failed (${response.status}).`);
        }
        return [type, payload as KotTemplateResponse] as const;
      }));
      const dataByType = Object.fromEntries(loaded) as Record<KotTemplateType, KotTemplateResponse>;
      setTemplateDataByType(dataByType);
      setTemplateConfigs({
        KITCHEN: dataByType.KITCHEN.current.config ?? DEFAULT_KITCHEN_TEMPLATE,
        CUSTOMER: dataByType.CUSTOMER.current.config ?? DEFAULT_CUSTOMER_TEMPLATE,
      });
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : "Unable to load KOT designer.");
    } finally {
      setTemplateLoading(false);
    }
  }, [accessToken, onSignOut]);

  useEffect(() => {
    void loadTemplate();
  }, [loadTemplate]);

  const moveTemplateSection = (section: KotSectionId, destinationIndex: number) => {
    setTemplateConfig((current) => {
      const next = [...current.sectionOrder];
      const sourceIndex = next.indexOf(section);
      if (sourceIndex < 0 || destinationIndex < 0 || destinationIndex >= next.length) return current;
      next.splice(sourceIndex, 1);
      next.splice(destinationIndex, 0, section);
      return { ...current, sectionOrder: next };
    });
  };

  const dropTemplateSection = (target: KotSectionId) => {
    if (draggedSection && draggedSection !== target) {
      const currentOrder = templateConfig.sectionOrder;
      const targetIndex = currentOrder.indexOf(target);
      moveTemplateSection(draggedSection, targetIndex);
    }
    setDraggedSection(null);
    setDragOverSection(null);
  };
  const loadTimingSettings = useCallback(async () => {
    setTimingSettingsLoading(true);
    setTimingSettingsError("");
    try {
      const response = await fetch(`${API_URL}/kot/timing-settings`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = await response.json().catch(() => null);
      if (response.status === 401) {
        await onSignOut();
        throw new Error("Your session expired. Please sign in again.");
      }
      if (!response.ok || !payload || !Array.isArray(payload.settings)) {
        throw new Error(payload && typeof payload.error === "string" ? payload.error : `Timing settings request failed (${response.status}).`);
      }
      const loadedSettings = payload.settings as KotChannelTimingSetting[];
      setTimingSettings(loadedSettings);
      setTimingSettingsDraft(loadedSettings);
    } catch (error) {
      setTimingSettingsError(error instanceof Error ? error.message : "Unable to load channel timing settings.");
    } finally {
      setTimingSettingsLoading(false);
    }
  }, [accessToken, onSignOut]);

  useEffect(() => { void loadTimingSettings(); }, [loadTimingSettings]);

  const discardTimingSettings = useCallback(() => {
    setTimingSettingsDraft(timingSettings.map((setting) => ({ ...setting })));
    setTimingSettingsError("");
    setTimingSettingsNotice("");
    setTimingSettingsOpen(false);
  }, [timingSettings]);

  useEffect(() => {
    if (!timingSettingsOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !timingPopoverRef.current?.contains(event.target)) {
        discardTimingSettings();
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") discardTimingSettings();
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [timingSettingsOpen, discardTimingSettings]);

  const toggleTimingSettings = () => {
    if (timingSettingsOpen) {
      setTimingSettingsDraft(timingSettings);
      setTimingSettingsError("");
      setTimingSettingsNotice("");
      setTimingSettingsOpen(false);
      return;
    }

    setTimingSettingsDraft(timingSettings.map((setting) => ({ ...setting })));
    setTimingSettingsError("");
    setTimingSettingsNotice("");
    setTimingSettingsOpen(true);
    void loadTimingSettings();
  };

  const updateTimingSetting = (channel: OrderChannel, field: KotTimingField, rawValue: string) => {
    const value = rawValue.trim() === "" ? null : Number(rawValue);
    setTimingSettingsDraft((current) => current.map((setting) =>
      setting.channel === channel ? { ...setting, [field]: value } : setting,
    ));
  };

  const saveTimingSettings = async () => {
    setTimingSettingsSaving(true);
    setTimingSettingsError("");
    setTimingSettingsNotice("");
    try {
      const response = await fetch(`${API_URL}/kot/timing-settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ settings: timingSettingsDraft }),
      });
      const payload = await response.json().catch(() => null);
      if (response.status === 401) {
        await onSignOut();
        throw new Error("Your session expired. Please sign in again.");
      }
      if (!response.ok || !payload || !Array.isArray(payload.settings)) {
        throw new Error(payload && typeof payload.error === "string" ? payload.error : `Unable to save timing settings (${response.status}).`);
      }
      const savedSettings = payload.settings as KotChannelTimingSetting[];
      setTimingSettings(savedSettings);
      setTimingSettingsDraft(savedSettings);
      setTimingSettingsNotice("Timing targets saved. Live timers now use the updated thresholds.");
    } catch (error) {
      setTimingSettingsError(error instanceof Error ? error.message : "Unable to save channel timing settings.");
    } finally {
      setTimingSettingsSaving(false);
    }
  };

  const printKot = (order: OrderRecord, type: KotTemplateType) => {
    setPrintError("");
    setPrintNotice("");
    const printWindow = window.open("", "_blank", "popup,width=420,height=720");
    if (!printWindow) {
      setPrintError("The print window was blocked. Allow pop-ups for the Kitchen OS site, then try again.");
      return;
    }
    setPrintingOrderId(order.id);
    try {
      printWindow.document.open();
      printWindow.document.write(buildKotPrintHtml(order, templateConfigs[type], type));
      printWindow.document.close();
      printWindow.addEventListener("afterprint", () => {
        printWindow.close();
        setPrintingOrderId(null);
      }, { once: true });
      window.setTimeout(() => {
        if (!printWindow.closed) {
          printWindow.focus();
          printWindow.print();
          setPrintNotice(`${type === "CUSTOMER" ? "Customer receipt" : "Kitchen KOT"} opened for ${order.kotNumber}. Choose POS-80C and confirm the paper output.`);
          window.setTimeout(() => setPrintingOrderId((current) => current === order.id ? null : current), 60000);
        }
      }, 600);
    } catch (error) {
      printWindow.close();
      setPrintingOrderId(null);
      setPrintError(error instanceof Error ? error.message : "Unable to open the KOT print dialog.");
    }
  };

  const printBothKotCopies = (order: OrderRecord) => {
    setPrintError("");
    setPrintNotice("");
    const printWindow = window.open("", "_blank", "popup,width=420,height=900");
    if (!printWindow) {
      setPrintError("The print window was blocked. Allow pop-ups for the Kitchen OS site, then try again.");
      return;
    }
    setPrintingOrderId(order.id);
    try {
      printWindow.document.open();
      printWindow.document.write(buildBothKotPrintHtml(order, templateConfigs.CUSTOMER, templateConfigs.KITCHEN));
      printWindow.document.close();
      printWindow.addEventListener("afterprint", () => {
        printWindow.close();
        setPrintingOrderId(null);
      }, { once: true });
      window.setTimeout(() => {
        if (!printWindow.closed) {
          printWindow.focus();
          printWindow.print();
          setPrintNotice(`Customer receipt + kitchen ticket opened for ${order.kotNumber}.`);
          window.setTimeout(() => setPrintingOrderId((current) => current === order.id ? null : current), 60000);
        }
      }, 600);
    } catch (error) {
      printWindow.close();
      setPrintingOrderId(null);
      setPrintError(error instanceof Error ? error.message : "Unable to open both KOT copies.");
    }
  };

  const handleAutoPrintToggle = (enabled: boolean) => {
    setAutoPrintEnabled(enabled);
    setAutoPrintNotice(enabled
      ? "Auto-print enabled on this browser. Use the dedicated Chrome --kiosk-printing shortcut and set DCode DCRP30 as the Windows default printer."
      : "Auto-print disabled. Orders will require manual printing.");
    try {
      window.localStorage.setItem("ukos.kot.autoPrintEnabled.v1", String(enabled));
    } catch {
      setAutoPrintNotice("This browser could not save the auto-print setting. Check browser storage permissions.");
    }
  };

  const recordAutoPrintSuccess = (order: OrderRecord) => {
    autoPrintingKotIdsRef.current.delete(order.id);
    autoPrintedKotIdsRef.current.add(order.id);
    const savedIds = [...autoPrintedKotIdsRef.current].slice(-500);
    try {
      window.localStorage.setItem("ukos.kot.autoPrintedIds.v1", JSON.stringify(savedIds));
      setAutoPrintNotice(`Customer receipt and kitchen ticket for ${order.kotNumber} sent to the Windows default printer.`);
    } catch {
      setAutoPrintNotice(`Both copies for ${order.kotNumber} were sent, but this browser could not persist duplicate-print history. Keep this tab open for the current session.`);
    }
  };

  const printKotAutomatically = (order: OrderRecord, sample = false, reservedWindow?: Window | null) => {
    if (!sample && !autoPrintEnabled) {
      reservedWindow?.close();
      return;
    }
    if (!sample && (autoPrintedKotIdsRef.current.has(order.id) || autoPrintingKotIdsRef.current.has(order.id))) {
      reservedWindow?.close();
      return;
    }

    if (!sample) autoPrintingKotIdsRef.current.add(order.id);
    setPrintError("");
    setAutoPrintNotice("");
    setPrintingOrderId(order.id);

    // Reserve a print window synchronously during the Accept click. The order
    // details are written only after the API confirms that acceptance succeeded.
    // This avoids relying on an asynchronous hidden-iframe print call that may
    // be restricted by the browser's user-gesture policy.
    if (reservedWindow) {
      try {
        reservedWindow.document.open();
        reservedWindow.document.write(sample
          ? buildKotPrintHtml(order, templateConfigs[activeTemplateType], activeTemplateType)
          : buildBothKotPrintHtml(order, templateConfigs.CUSTOMER, templateConfigs.KITCHEN));
        reservedWindow.document.close();
        reservedWindow.addEventListener("afterprint", () => {
          if (!reservedWindow.closed) reservedWindow.close();
          setPrintingOrderId((current) => current === order.id ? null : current);
        }, { once: true });

        window.setTimeout(() => {
          try {
            if (reservedWindow.closed) throw new Error("The automatic KOT print window was closed before printing.");
            reservedWindow.focus();
            reservedWindow.print();
            recordAutoPrintSuccess(order);
            setPrintingOrderId(null);
            window.setTimeout(() => {
              if (!reservedWindow.closed) reservedWindow.close();
            }, 10000);
          } catch (error) {
            autoPrintingKotIdsRef.current.delete(order.id);
            setPrintingOrderId(null);
            setPrintError(error instanceof Error ? error.message : "Unable to send the KOT to the Windows printer.");
            if (!reservedWindow.closed) reservedWindow.close();
          }
        }, 600);
      } catch (error) {
        autoPrintingKotIdsRef.current.delete(order.id);
        setPrintingOrderId(null);
        setPrintError(error instanceof Error ? error.message : "Unable to prepare the automatic KOT print window.");
        if (!reservedWindow.closed) reservedWindow.close();
      }
      return;
    }

    const frame = document.createElement("iframe");
    frame.title = `KOT print job ${order.kotNumber}`;
    frame.setAttribute("aria-hidden", "true");
    frame.style.position = "fixed";
    frame.style.left = "-10000px";
    frame.style.top = "0";
    frame.style.width = "1px";
    frame.style.height = "1px";
    frame.style.border = "0";
    frame.style.opacity = "0";

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      frame.contentWindow?.removeEventListener("afterprint", cleanup);
      window.clearTimeout(fallbackCleanup);
      window.setTimeout(() => frame.remove(), 250);
    };
    const fallbackCleanup = window.setTimeout(cleanup, 30000);

    try {
      document.body.appendChild(frame);
      const printDocument = frame.contentDocument;
      const printWindow = frame.contentWindow;
      if (!printDocument || !printWindow) {
        throw new Error("The browser could not prepare the KOT print frame.");
      }

      printWindow.addEventListener("afterprint", cleanup, { once: true });
      printDocument.open();
      printDocument.write(sample
        ? buildKotPrintHtml(order, templateConfigs[activeTemplateType], activeTemplateType)
        : buildBothKotPrintHtml(order, templateConfigs.CUSTOMER, templateConfigs.KITCHEN));
      printDocument.close();

      window.setTimeout(() => {
        try {
          if (!frame.contentWindow) throw new Error("The KOT print frame is no longer available.");
          frame.contentWindow.focus();
          frame.contentWindow.print();

          if (!sample) {
            recordAutoPrintSuccess(order);
          } else {
            setAutoPrintNotice(`Sample ${activeTemplateType === "CUSTOMER" ? "customer receipt" : "kitchen ticket"} sent to the Windows default printer.`);
          }
          setPrintingOrderId(null);
          window.setTimeout(cleanup, 10000);
        } catch (error) {
          if (!sample) autoPrintingKotIdsRef.current.delete(order.id);
          setPrintingOrderId(null);
          setPrintError(error instanceof Error ? error.message : "Unable to send the KOT to the Windows printer.");
          cleanup();
        }
      }, 500);
    } catch (error) {
      if (!sample) autoPrintingKotIdsRef.current.delete(order.id);
      setPrintingOrderId(null);
      setPrintError(error instanceof Error ? error.message : "Unable to prepare the KOT print job.");
      cleanup();
    }
  };

  const updateStatus = async (order: OrderRecord, status: OrderStatus) => {
    const actionLabel = status === "CONFIRMED" ? "accept" : status === "OUT_FOR_DELIVERY" ? "mark handed over" : status === "CANCELLED" ? "cancel" : `move to ${statusLabel(status).toLowerCase()}`;
    if (status === "CANCELLED" && !window.confirm(`Cancel ${order.kotNumber}? This will remain in today's order history.`)) return;
    // Reserve this popup synchronously in the staff's Accept click, before
    // the status request yields control to the browser.
    let pendingAutoPrintWindow: Window | null = status === "CONFIRMED" && autoPrintEnabled
      ? window.open("", "_blank", "popup,width=420,height=720")
      : null;

    setBusyOrder(true);
    setApiError("");
    setNotice("");
    try {
      const response = await fetch(`${API_URL}/orders/${order.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json().catch(() => null);
      if (response.status === 401) {
        await onSignOut();
        throw new Error("Your session expired. Please sign in again.");
      }
      if (!response.ok) {
        throw new Error(payload && typeof payload.error === "string" ? payload.error : `Unable to ${actionLabel} order.`);
      }
      const updatedOrder = payload as OrderRecord;
      setSelectedOrder(updatedOrder);
      setNotice(`${order.kotNumber} ${status === "CONFIRMED" ? "accepted" : status === "OUT_FOR_DELIVERY" ? "handed over" : status === "CANCELLED" ? "cancelled" : `updated to ${statusLabel(status).toLowerCase()}`}.`);
      if (status === "CONFIRMED" && autoPrintEnabled) {
        if (pendingAutoPrintWindow) {
          printKotAutomatically(updatedOrder, false, pendingAutoPrintWindow);
          pendingAutoPrintWindow = null;
        } else {
          setPrintError("Order accepted, but the browser blocked the automatic print window. Allow pop-ups for Kitchen OS, then use Print KOT for this order.");
        }
      }
      await loadOrders(true);
    } catch (error) {
      if (pendingAutoPrintWindow && !pendingAutoPrintWindow.closed) pendingAutoPrintWindow.close();
      setApiError(error instanceof Error ? error.message : "Unable to update this order.");
    } finally {
      setBusyOrder(false);
    }
  };

  const saveTemplate = async (event: FormEvent) => {
    event.preventDefault();
    setTemplateSaving(true);
    setTemplateError("");
    setTemplateNotice("");
    try {
      const response = await fetch(`${API_URL}/kot/templates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ type: activeTemplateType, config: templateConfig }),
      });
      const payload = await response.json().catch(() => null);
      if (response.status === 401) {
        await onSignOut();
        throw new Error("Your session expired. Please sign in again.");
      }
      if (!response.ok) {
        throw new Error(payload && typeof payload.error === "string" ? payload.error : `Template save failed (${response.status}).`);
      }
      setTemplateNotice(`${activeTemplateType === "CUSTOMER" ? "Customer receipt" : "Kitchen KOT"} template v${payload.versionNumber} saved. The other copy is unchanged.`);
      await loadTemplate();
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : "Unable to save KOT template.");
    } finally {
      setTemplateSaving(false);
    }
  };

  const resetTemplate = () => {
    setTemplateConfig(defaultTemplate(activeTemplateType));
    setTemplateNotice(`Default ${activeTemplateType === "CUSTOMER" ? "customer receipt" : "kitchen KOT"} design loaded in the preview. Save to create a new version.`);
    setTemplateError("");
  };

  const statusCounts = ordersData?.statusCounts;
  const channelCounts = ordersData?.channelCounts;
  const totalPages = ordersData?.totalPages ?? 1;

  if (view === "designer") {
    return (
      <main className="kot-shell">
        <header className="kot-header">
          <div>
            <p className="kot-eyebrow">UNDERGROUND KITCHEN OS</p>
            <h1>KOT Designer</h1>
            <p className="kot-muted">Design the customer receipt and kitchen ticket separately. Each copy has its own paper preview, content and section order.</p>
          </div>
          <div className="kot-header-actions">
            <button className="kot-button kot-button-secondary" onClick={() => setView("orders")}>Back to orders</button>
            <button className="kot-button kot-button-quiet" onClick={() => void onSignOut()}>Sign out</button>
          </div>
        </header>

        {templateError && <ApiError>{templateError}</ApiError>}
        {templateNotice && <div className="kot-alert kot-alert-success" role="status">{templateNotice}</div>}
        {printError && <ApiError>{printError}</ApiError>}
        {printNotice && <div className="kot-alert kot-alert-success" role="status">{printNotice}</div>}
        {autoPrintNotice && <div className="kot-alert kot-alert-success" role="status">{autoPrintNotice}</div>}

        {templateLoading ? (
          <div className="kot-empty"><div className="kot-spinner"/>Loading template settings…</div>
        ) : (
          <form className="kot-designer-layout" onSubmit={saveTemplate}>
            <section className="kot-panel kot-designer-controls">
              <div className="kot-panel-heading">
                <div><h2>{activeTemplateType === "CUSTOMER" ? "Customer receipt" : "Kitchen ticket"}</h2><p>{activeTemplateType === "CUSTOMER" ? "Detailed copy with customer details, item prices and amount payable." : "Clean preparation copy: order, customer name, ingredients and instructions. No prices or customer contact details."}</p></div>
                <span className="kot-version-pill">v{templateData?.current.versionNumber ?? 0}</span>
              </div>

              <div className="kot-template-tabs" role="tablist" aria-label="Choose ticket design">
                <button type="button" role="tab" aria-selected={activeTemplateType === "CUSTOMER"} className={activeTemplateType === "CUSTOMER" ? "is-active" : ""} onClick={() => { setActiveTemplateType("CUSTOMER"); setTemplateError(""); setTemplateNotice(""); }}>
                  <strong>Customer copy</strong><small>Detailed · pricing</small>
                </button>
                <button type="button" role="tab" aria-selected={activeTemplateType === "KITCHEN"} className={activeTemplateType === "KITCHEN" ? "is-active" : ""} onClick={() => { setActiveTemplateType("KITCHEN"); setTemplateError(""); setTemplateNotice(""); }}>
                  <strong>Kitchen copy</strong><small>Preparation · no prices</small>
                </button>
              </div>

              <label className="kot-field-label">Paper width</label>
              <div className="kot-choice-row">
                {(["80mm", "58mm"] as const).map((width) => (
                  <button key={width} type="button" className={`kot-choice ${templateConfig.paperWidth === width ? "is-selected" : ""}`} onClick={() => setTemplateConfig((value) => ({ ...value, paperWidth: width }))}>
                    <strong>{width}</strong><span>{width === "80mm" ? "Recommended" : "Compact"}</span>
                  </button>
                ))}
              </div>

              <label className="kot-field-label" htmlFor="kot-header">Header text</label>
              <input id="kot-header" className="kot-input" maxLength={80} value={templateConfig.headerText} onChange={(event) => setTemplateConfig((value) => ({ ...value, headerText: event.target.value }))}/>
              <label className="kot-field-label" htmlFor="kot-footer">Footer text</label>
              <input id="kot-footer" className="kot-input" maxLength={160} value={templateConfig.footerText} onChange={(event) => setTemplateConfig((value) => ({ ...value, footerText: event.target.value }))}/>

              <div className="kot-settings-grid">
                <label className="kot-field-label" htmlFor="kot-font-size">Font size</label>
                <input id="kot-font-size" className="kot-input" type="number" min={10} max={18} value={templateConfig.fontSize} onChange={(event) => setTemplateConfig((value) => ({ ...value, fontSize: Number(event.target.value) }))}/>
                <label className="kot-field-label" htmlFor="kot-line-spacing">Line spacing</label>
                <select id="kot-line-spacing" className="kot-input" value={templateConfig.lineSpacing} onChange={(event) => setTemplateConfig((value) => ({ ...value, lineSpacing: event.target.value as KotTemplateConfig["lineSpacing"] }))}>
                  <option value="compact">Compact</option><option value="normal">Normal</option><option value="relaxed">Relaxed</option>
                </select>
                <label className="kot-field-label" htmlFor="kot-heading-weight">Heading weight</label>
                <select id="kot-heading-weight" className="kot-input" value={templateConfig.headingWeight} onChange={(event) => setTemplateConfig((value) => ({ ...value, headingWeight: event.target.value as KotTemplateConfig["headingWeight"] }))}>
                  <option value="bold">Bold</option><option value="normal">Normal</option>
                </select>
                <label className="kot-field-label" htmlFor="kot-margin">Print margins</label>
                <select id="kot-margin" className="kot-input" value={templateConfig.margin} onChange={(event) => setTemplateConfig((value) => ({ ...value, margin: event.target.value as KotTemplateConfig["margin"] }))}>
                  <option value="narrow">Narrow</option><option value="normal">Normal</option><option value="wide">Wide</option>
                </select>
                <label className="kot-field-label" htmlFor="kot-alignment">Alignment</label>
                <select id="kot-alignment" className="kot-input" value={templateConfig.alignment} onChange={(event) => setTemplateConfig((value) => ({ ...value, alignment: event.target.value as KotTemplateConfig["alignment"] }))}>
                  <option value="left">Left</option><option value="center">Center</option>
                </select>
              </div>

              <h3 className="kot-subheading">Arrange ticket sections</h3>
              <p className="kot-helper">Drag sections into the order you prefer. The arrows also work with touch screens and keyboards.</p>
              <div className="kot-section-organizer">
                {templateConfig.sectionOrder.map((section, index) => (
                  <div
                    key={section}
                    draggable
                    onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDraggedSection(section); }}
                    onDragOver={(event) => { event.preventDefault(); setDragOverSection(section); }}
                    onDragLeave={() => setDragOverSection((current) => current === section ? null : current)}
                    onDrop={(event) => { event.preventDefault(); dropTemplateSection(section); }}
                    onDragEnd={() => { setDraggedSection(null); setDragOverSection(null); }}
                    className={`kot-section-row ${draggedSection === section ? "is-dragging" : ""} ${dragOverSection === section ? "is-drop-target" : ""}`}
                  >
                    <span className="kot-section-grip" aria-hidden="true">⠿</span>
                    <span className="kot-section-index">{index + 1}</span>
                    <strong>{KOT_SECTION_LABELS[section]}</strong>
                    <span className="kot-section-actions">
                      <button type="button" className="kot-icon-button" aria-label={`Move ${KOT_SECTION_LABELS[section]} up`} title="Move up" disabled={index === 0} onClick={() => moveTemplateSection(section, index - 1)}>↑</button>
                      <button type="button" className="kot-icon-button" aria-label={`Move ${KOT_SECTION_LABELS[section]} down`} title="Move down" disabled={index === templateConfig.sectionOrder.length - 1} onClick={() => moveTemplateSection(section, index + 1)}>↓</button>
                    </span>
                  </div>
                ))}
              </div>

              <h3 className="kot-subheading">Content options</h3>
              <div className="kot-toggle-list">
                <label><span>Brand name</span><input type="checkbox" checked={templateConfig.showBrandName} onChange={(event) => setTemplateConfig((value) => ({ ...value, showBrandName: event.target.checked }))}/></label>
                <label><span>External order reference</span><input type="checkbox" checked={templateConfig.showExternalOrderReference} onChange={(event) => setTemplateConfig((value) => ({ ...value, showExternalOrderReference: event.target.checked }))}/></label>
                {activeTemplateType === "CUSTOMER" && <label><span>Invoice number</span><input type="checkbox" checked={templateConfig.showInvoiceNumber} onChange={(event) => setTemplateConfig((value) => ({ ...value, showInvoiceNumber: event.target.checked }))}/></label>}
                <label><span>Full customer name</span><input type="checkbox" checked={templateConfig.showCustomerFirstName} onChange={(event) => setTemplateConfig((value) => ({ ...value, showCustomerFirstName: event.target.checked }))}/></label>
                <label><span>Ingredient details</span><input type="checkbox" checked={templateConfig.showIngredients} onChange={(event) => setTemplateConfig((value) => ({ ...value, showIngredients: event.target.checked }))}/></label>
                {activeTemplateType === "CUSTOMER" && <>
                  <label><span>Customer phone</span><input type="checkbox" checked={templateConfig.showCustomerPhone} onChange={(event) => setTemplateConfig((value) => ({ ...value, showCustomerPhone: event.target.checked }))}/></label>
                  <label><span>Delivery address</span><input type="checkbox" checked={templateConfig.showDeliveryAddress} onChange={(event) => setTemplateConfig((value) => ({ ...value, showDeliveryAddress: event.target.checked }))}/></label>
                  <label><span>Price beside each bowl</span><input type="checkbox" checked={templateConfig.showItemPrices} onChange={(event) => setTemplateConfig((value) => ({ ...value, showItemPrices: event.target.checked }))}/></label>
                  <label><span>Items subtotal</span><input type="checkbox" checked={templateConfig.showSubtotal} onChange={(event) => setTemplateConfig((value) => ({ ...value, showSubtotal: event.target.checked }))}/></label>
                  <label><span>Delivery charge</span><input type="checkbox" checked={templateConfig.showDeliveryCharge} onChange={(event) => setTemplateConfig((value) => ({ ...value, showDeliveryCharge: event.target.checked }))}/></label>
                  <label className="is-locked"><span>Amount payable <small>Required</small></span><input type="checkbox" checked disabled/></label>
                  <label><span>Payment method</span><input type="checkbox" checked={templateConfig.showPaymentMethod} onChange={(event) => setTemplateConfig((value) => ({ ...value, showPaymentMethod: event.target.checked }))}/></label>
                </>}
              </div>
              {activeTemplateType === "KITCHEN"
                ? <p className="kot-helper">Kitchen copy is protected from displaying prices, phone numbers, delivery address or payment details.</p>
                : <p className="kot-helper">Customer copy uses server-calculated item prices, delivery charge and total. Customer phone and address can be toggled for the copy packed with the order.</p>}

              <div className="kot-form-actions">
                <button type="button" className="kot-button kot-button-secondary" onClick={resetTemplate}>Restore default</button>
                <button type="submit" className="kot-button kot-button-primary" disabled={templateSaving}>{templateSaving ? "Saving…" : "Save this design"}</button>
              </div>
            </section>

            <section className="kot-preview-column">
              <div className="kot-panel">
                <div className="kot-panel-heading">
                  <div><h2>Live {activeTemplateType === "CUSTOMER" ? "customer receipt" : "kitchen ticket"} preview</h2><p>Sample data only — no real order is changed.</p></div>
                  <span className="kot-preview-tag">{activeTemplateType} · PREVIEW</span>
                </div>
                {activeTemplateType === "CUSTOMER" && <p className="kot-preview-hint">This is the detailed slip to accompany the order. Prices are sourced from the server-calculated order.</p>}
                {activeTemplateType === "KITCHEN" && <p className="kot-preview-hint">This is the kitchen preparation slip. No price, phone number or delivery address is printed.</p>}
                <div className="kot-paper-stage">
                  <article className={`kot-paper kot-paper-${templateConfig.paperWidth === "80mm" ? "80" : "58"} kot-paper-margin-${templateConfig.margin} kot-paper-heading-${templateConfig.headingWeight}`} style={{ fontSize: `${templateConfig.fontSize}px`, lineHeight: templateConfig.lineSpacing === "compact" ? 1.2 : templateConfig.lineSpacing === "relaxed" ? 1.65 : 1.4, textAlign: templateConfig.alignment }}>
                    {templateConfig.sectionOrder.map((section) => {
                      const sample = sampleKotOrder();
                      const sampleCustomer = customerDetails(sample);
                      const sampleSubtotal = sample.bowls.reduce((sum, bowl) => sum + bowl.price, 0);
                      switch (section) {
                        case "order":
                          return <div className="kot-paper-section" key={section}>
                            {templateConfig.showBrandName && <div className="kot-paper-brand">{templateConfig.headerText || "UNDERGROUND KITCHEN"}</div>}
                            <div className="kot-paper-copy-kind">{activeTemplateType === "CUSTOMER" ? "CUSTOMER COPY" : "KITCHEN COPY"}</div>
                            <div className="kot-paper-number">{sample.kotNumber}</div>
                            <div className="kot-paper-meta">WEBSITE · {timeLabel(sample.createdAt)}</div>
                            {templateConfig.showExternalOrderReference && <div className="kot-paper-meta">External ref: —</div>}
                            {activeTemplateType === "CUSTOMER" && templateConfig.showInvoiceNumber && <div className="kot-paper-meta">Invoice: {sample.invoiceNumber}</div>}
                          </div>;
                        case "customer":
                          return <div className="kot-paper-section" key={section}>
                            {templateConfig.showCustomerFirstName && <div className="kot-paper-customer-name">Customer: {sampleCustomer.name}</div>}
                            {activeTemplateType === "CUSTOMER" && templateConfig.showCustomerPhone && <div className="kot-paper-meta">Phone: {sampleCustomer.phone}</div>}
                            {activeTemplateType === "CUSTOMER" && templateConfig.showDeliveryAddress && <div className="kot-paper-meta">Delivery: {sampleCustomer.address}, {sampleCustomer.area}, {sampleCustomer.city}</div>}
                          </div>;
                        case "items":
                          return <div className="kot-paper-section" key={section}>
                            {sample.bowls.map((bowl) => <div className="kot-paper-item" key={bowl.id}>
                              <div className="kot-paper-item-row"><strong>{bowl.quantity} × {bowl.bowlName}</strong>{activeTemplateType === "CUSTOMER" && templateConfig.showItemPrices && <strong>₹{bowl.price.toFixed(2)}</strong>}</div>
                              {templateConfig.showIngredients && bowl.details && <div className="kot-paper-details">{bowl.details.split("\n").map((line) => <div key={line}>{line}</div>)}</div>}
                            </div>)}
                          </div>;
                        case "totals":
                          return activeTemplateType === "CUSTOMER" ? <div className="kot-paper-section" key={section}>
                            {templateConfig.showSubtotal && <div className="kot-paper-total-row"><span>Items subtotal</span><strong>₹{sampleSubtotal.toFixed(2)}</strong></div>}
                            {templateConfig.showDeliveryCharge && <div className="kot-paper-total-row"><span>Delivery</span><strong>₹{sample.deliveryCharge?.toFixed(2)}</strong></div>}
                            {templateConfig.showTotal && <div className="kot-paper-grand-total"><span>AMOUNT PAYABLE</span><strong>₹{sample.total.toFixed(2)}</strong></div>}
                            {templateConfig.showPaymentMethod && <div className="kot-paper-meta">Payment: {sample.paymentMethod}</div>}
                          </div> : <div key={section}/>;
                        case "special":
                          return <div className="kot-paper-section" key={section}><div className="kot-paper-special"><strong>Special instructions</strong><div>{sample.specialInstructions}</div></div></div>;
                        case "footer":
                          return <div className="kot-paper-section" key={section}>{templateConfig.footerText && <div className="kot-paper-footer">{templateConfig.footerText}</div>}</div>;
                        default:
                          return <div key={section}/>;
                      }
                    }).reduce<ReactNode[]>((nodes, node, index) => {
                      if (index > 0) nodes.push(<div className="kot-paper-section-divider" key={`divider-${index}`}/>);
                      nodes.push(node);
                      return nodes;
                    }, [])}
                  </article>
                </div>
              </div>

              <div className="kot-panel">
                <div className="kot-panel-heading"><div><h2>Template history</h2><p>Saved layouts are retained as versions.</p></div></div>
                {templateData?.history.length ? (
                  <div className="kot-history-list">
                    {templateData.history.map((version) => (
                      <div className="kot-history-row" key={version.id}>
                        <strong>Version {version.versionNumber}</strong>
                        <span>{dateTimeLabel(version.createdAt)}</span>
                        {version.isActive ? <span className="kot-status kot-status-accepted">Active</span> : <span className="kot-status">Previous</span>}
                      </div>
                    ))}
                  </div>
                ) : <p className="kot-helper">No saved template versions yet. The default preview is currently in use.</p>}
              </div>

              <div className="kot-panel kot-readiness-panel">
                <div className="kot-panel-heading"><div><h2>Kitchen print settings</h2><p>Silent printing requires the dedicated Chrome shortcut and DCode as the Windows default.</p></div></div>
                <div className="kot-readiness-row"><span>Automatic printing</span><strong>{autoPrintEnabled ? "ON · this browser" : "OFF · manual only"}</strong></div>
                <div className="kot-readiness-row"><span>Auto-print trigger</span><strong>After staff acceptance</strong></div>
                <div className="kot-readiness-row"><span>Printer</span><strong>DCode DCRP30 · Windows driver</strong></div>
                <div className="kot-readiness-row"><span>Default paper preview</span><strong>{templateConfig.paperWidth}</strong></div>
                <div className="kot-readiness-row"><span>Website channel</span><strong className="kot-ready-text">Existing order flow</strong></div>
                <div className="kot-readiness-row"><span>Zomato</span><strong className="kot-pending-text">Integration pending</strong></div>
                <div className="kot-readiness-row"><span>Swiggy</span><strong className="kot-pending-text">Integration pending</strong></div>
              </div>
              <div className="kot-note-card">
                <strong>Printer test</strong>
                <p>{autoPrintEnabled ? "Send a sample ticket through Chrome silent printing. Confirm that it prints without a browser dialog." : "Print a sample ticket through the Windows printer driver. This opens the browser print dialog; enable Auto-print and use the dedicated Chrome kiosk shortcut to test silent printing."}</p>
                <button type="button" className="kot-button kot-button-primary kot-print-sample" onClick={() => autoPrintEnabled ? printKotAutomatically(sampleKotOrder(), true) : printKot(sampleKotOrder(), activeTemplateType)} disabled={printingOrderId !== null || templateLoading}>
                  {printingOrderId === "sample-kot" ? "Sending sample…" : autoPrintEnabled ? "Print this copy silently" : "Print this copy"}
                </button>
              </div>
            </section>
          </form>
        )}
      </main>
    );
  }

  const orders = ordersData?.items ?? [];
  const countNew = statusCounts?.PENDING ?? 0;
  // PREPARING is retained only as a legacy persisted value. It is displayed
  // and counted as ACCEPTED so the kitchen sees only the three approved stages.
  const countAccepted = (statusCounts?.CONFIRMED ?? 0) + (statusCounts?.PREPARING ?? 0);
  const countReady = statusCounts?.READY ?? 0;

  return (
    <main className="kot-shell">
      <header className="kot-header">
        <div>
          <p className="kot-eyebrow">UNDERGROUND KITCHEN OS</p>
          <h1>Kitchen Orders</h1>
          <p className="kot-muted">Signed in as {signedInEmail} · All order channels in one place</p>
        </div>
        <div className="kot-header-actions">
          <button className="kot-button kot-button-secondary" onClick={onOpenIngredients}>Ingredients</button>
          <button className="kot-button kot-button-secondary" onClick={onOpenRecipes}>Recipes</button>
          <button className="kot-button kot-button-secondary" onClick={onOpenPurchases}>Purchases</button>
          <button className="kot-button kot-button-primary" onClick={() => { setTimingSettingsOpen(false); setView("designer"); setTemplateNotice(""); }}>Design KOT</button>
          <button className="kot-button kot-button-quiet" onClick={() => void onSignOut()}>Sign out</button>
        </div>
      </header>

      {apiError && <ApiError>{apiError}</ApiError>}
      {notice && <div className="kot-alert kot-alert-success" role="status">{notice}</div>}
      {printError && <ApiError>{printError}</ApiError>}
      {printNotice && <div className="kot-alert kot-alert-success" role="status">{printNotice}</div>}
      {autoPrintNotice && <div className="kot-alert kot-alert-success" role="status">{autoPrintNotice}</div>}

      <section className="kot-stat-grid" aria-label="Today's order status counts">
        <div className="kot-stat-card"><span>New</span><strong>{countNew}</strong><small>Awaiting acceptance</small></div>
        <div className="kot-stat-card"><span>Accepted</span><strong>{countAccepted}</strong><small>Kitchen has accepted the order</small></div>
        <div className="kot-stat-card"><span>Ready</span><strong>{countReady}</strong><small>Awaiting handover</small></div>
      </section>

      <section className="kot-panel kot-filter-panel">
        <div className="kot-filter-topline">
          <div>
            <h2>{datePreset === "TODAY" ? "Today's KOTs" : datePreset === "YESTERDAY" ? "Yesterday's KOTs" : "KOT history"}</h2>
            <p>{ordersData?.total ?? 0} matching orders · India time (IST) · Newest first</p>
          </div>
          <div className="kot-live-tools">
            <label className="kot-sound-toggle"><input type="checkbox" checked={soundEnabled} onChange={(event) => handleSoundToggle(event.target.checked)}/> Sound alerts</label>
            <label className="kot-auto-print-toggle" title="Auto-prints orders after staff acceptance. Silent printing requires the dedicated Chrome shortcut with --kiosk-printing and DCode DCRP30 as the Windows default printer.">
              <input type="checkbox" checked={autoPrintEnabled} onChange={(event) => handleAutoPrintToggle(event.target.checked)} aria-label="Enable automatic KOT printing after acceptance"/>
              <span>Auto-print</span><small>{autoPrintEnabled ? "ON · after acceptance" : "OFF · manual only"}</small>
            </label>
            <div className="kot-timing-utility" ref={timingPopoverRef}>
              <button
                type="button"
                className="kot-icon-button kot-timing-trigger"
                onClick={toggleTimingSettings}
                aria-expanded={timingSettingsOpen}
                aria-controls="kot-timing-popover"
                title="Set separate acceptance and preparation thresholds for each channel"
              >
                <span aria-hidden="true">◷</span> Timing
              </button>
              {timingSettingsOpen && (
                <section className="kot-timing-popover" id="kot-timing-popover" role="dialog" aria-label="Kitchen timing settings">
                  <header className="kot-timing-popover-header">
                    <div>
                      <strong>Kitchen timing</strong>
                      <small>Each channel and stage has its own thresholds.</small>
                    </div>
                    <button type="button" className="kot-timing-popover-close" onClick={discardTimingSettings} aria-label="Close timing settings">×</button>
                  </header>

                  {timingSettingsError && <div className="kot-timing-popover-error" role="alert">{timingSettingsError}</div>}
                  {timingSettingsNotice && <div className="kot-timing-popover-success" role="status">{timingSettingsNotice}</div>}

                  {timingSettingsLoading ? (
                    <p className="kot-helper">Loading channel timing settings…</p>
                  ) : (
                    <div className="kot-timing-popover-grid">
                      <div className="kot-timing-popover-heading" aria-hidden="true">
                        <span>Channel</span><span>Acceptance</span><span>Preparation</span>
                      </div>
                      {(["WEBSITE", "ZOMATO", "SWIGGY"] as OrderChannel[]).map((channel) => {
                        const setting = timingSettingsDraft.find((candidate) => candidate.channel === channel);
                        if (!setting) return null;
                        return (
                          <section className="kot-timing-popover-row" key={setting.channel}>
                            <strong className={`kot-channel kot-timing-popover-channel kot-channel-${setting.channel.toLowerCase()}`}>
                              {channelLabel(setting.channel)}
                            </strong>
                            <div className="kot-timing-popover-stage">
                              <label className="kot-timing-popover-field">
                                <span>Amber</span>
                                <input className="kot-input" type="number" min={1} max={1440} step={1} placeholder="Off" value={setting.acceptanceAmberMinutes ?? ""} aria-label={`${channelLabel(setting.channel)} acceptance amber minutes`} onChange={(event) => updateTimingSetting(setting.channel, "acceptanceAmberMinutes", event.target.value)}/>
                              </label>
                              <label className="kot-timing-popover-field">
                                <span>Late</span>
                                <input className="kot-input" type="number" min={1} max={1440} step={1} placeholder="Off" value={setting.acceptanceLateMinutes ?? ""} aria-label={`${channelLabel(setting.channel)} acceptance late minutes`} onChange={(event) => updateTimingSetting(setting.channel, "acceptanceLateMinutes", event.target.value)}/>
                              </label>
                            </div>
                            <div className="kot-timing-popover-stage">
                              <label className="kot-timing-popover-field">
                                <span>Amber</span>
                                <input className="kot-input" type="number" min={1} max={1440} step={1} placeholder="Off" value={setting.preparationAmberMinutes ?? ""} aria-label={`${channelLabel(setting.channel)} preparation amber minutes`} onChange={(event) => updateTimingSetting(setting.channel, "preparationAmberMinutes", event.target.value)}/>
                              </label>
                              <label className="kot-timing-popover-field">
                                <span>Late</span>
                                <input className="kot-input" type="number" min={1} max={1440} step={1} placeholder="Off" value={setting.preparationLateMinutes ?? ""} aria-label={`${channelLabel(setting.channel)} preparation late minutes`} onChange={(event) => updateTimingSetting(setting.channel, "preparationLateMinutes", event.target.value)}/>
                              </label>
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  )}

                  <footer className="kot-timing-popover-footer">
                    <p>Minutes · Late must exceed Amber. Leave both blank to turn off that stage's alert.</p>
                    <div>
                      <button type="button" className="kot-icon-button" onClick={discardTimingSettings} disabled={timingSettingsSaving}>Cancel</button>
                      <button type="button" className="kot-button kot-button-primary" onClick={() => void saveTimingSettings()} disabled={timingSettingsLoading || timingSettingsSaving}>
                        {timingSettingsSaving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </footer>
                </section>
              )}
            </div>
            <span className="kot-live-indicator"><i/> Live · 5 sec</span>
            <span className="kot-last-updated">{lastRefreshedAt ? `Updated ${timeLabel(lastRefreshedAt.toISOString())}` : "Waiting for first update"}</span>
            <button className="kot-icon-button" onClick={() => void loadOrders(true)} disabled={refreshing} aria-label="Refresh orders">{refreshing ? "Refreshing…" : "↻ Refresh"}</button>
          </div>
        </div>

        <div className="kot-filter-row">
          <div className="kot-segmented" role="group" aria-label="Date filter">
            <button className={datePreset === "TODAY" ? "is-active" : ""} onClick={() => { setDatePreset("TODAY"); setPage(1); }}>Today</button>
            <button className={datePreset === "YESTERDAY" ? "is-active" : ""} onClick={() => { setDatePreset("YESTERDAY"); setPage(1); }}>Yesterday</button>
            <button className={datePreset === "CUSTOM" ? "is-active" : ""} onClick={() => { setDatePreset("CUSTOM"); setPage(1); }}>Custom</button>
          </div>
          {datePreset === "CUSTOM" && <input className="kot-input kot-date-input" type="date" value={customDate} max={indiaDateKey()} onChange={(event) => { setCustomDate(event.target.value); setPage(1); }}/>}
          <select className="kot-input kot-filter-select" value={channelFilter} onChange={(event) => { setChannelFilter(event.target.value as "ALL" | OrderChannel); setPage(1); }} aria-label="Filter by order channel">
            <option value="ALL">All channels ({ordersData ? Object.values(channelCounts ?? {}).reduce((sum, count) => sum + count, 0) : 0})</option>
            <option value="WEBSITE">Website ({channelCounts?.WEBSITE ?? 0})</option>
            <option value="ZOMATO">Zomato ({channelCounts?.ZOMATO ?? 0})</option>
            <option value="SWIGGY">Swiggy ({channelCounts?.SWIGGY ?? 0})</option>
          </select>
          <select className="kot-input kot-filter-select" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as "ALL" | OrderStatusFilter); setPage(1); }} aria-label="Filter by order status">
            {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <input className="kot-input kot-search-input" placeholder="Search KOT / order / customer" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }}/>
        </div>
      </section>

      <section className="kot-order-list" aria-label="Kitchen orders">
        {loading ? (
          <div className="kot-empty"><div className="kot-spinner"/>Loading today's KOTs…</div>
        ) : orders.length === 0 ? (
          <div className="kot-empty">
            <div className="kot-empty-icon">⌑</div>
            <h2>No orders found</h2>
            <p>{datePreset === "TODAY" ? "New website, Zomato and Swiggy orders will appear here when received." : "Try another date or clear one of the filters."}</p>
          </div>
        ) : orders.map((order) => {
          const customer = customerDetails(order);
          const isSelected = selectedOrder?.id === order.id;
          return (
            <article className={`kot-order-card ${isSelected ? "is-selected" : ""}`} key={order.id}>
              <button className="kot-order-main" onClick={() => setSelectedOrder(isSelected ? null : order)} aria-expanded={isSelected} aria-label={`Open ${order.kotNumber} details`}>
                <div className="kot-order-primary">
                  <div className="kot-order-id-row">
                    <strong>{order.kotNumber}</strong>
                    <span className={`kot-channel kot-channel-${order.channel.toLowerCase()}`}>{channelLabel(order.channel)}</span>
                    {order.status === "PENDING" && <span className="kot-new-dot">NEW</span>}
                  </div>
                  <div className="kot-order-customer">{customer.name.trim() || "Guest"} <span>· {timeLabel(order.createdAt)}</span></div>
                  <div className="kot-order-items">{order.bowls.map((bowl) => `${bowl.quantity} × ${bowl.bowlName}`).join(" · ") || "Order items pending"}</div>
                </div>
                <div className="kot-order-meta">
                  <span className={`kot-status kot-status-${order.status.toLowerCase()}`}>{statusLabel(order.status)}</span>
                  <small>{order.externalOrderId ? `Ref ${order.externalOrderId}` : order.invoiceNumber}</small>
                </div>
              </button>
              {(() => {
                const timer = getOrderTimer(order, clockNow, timingSettings);
                return (
                  <div className="kot-card-operations">
                    <div className={`kot-stage-timer kot-stage-timer-${timer.severity.toLowerCase()}`}>
                      <span>{timer.label}</span>
                      <strong>{timer.value}</strong>
                      <small>{timer.helper}</small>
                    </div>
                    <div className="kot-card-actions">
                      {order.status === "PENDING" && <button className="kot-button kot-button-primary kot-card-action" disabled={busyOrder} onClick={() => void updateStatus(order, "CONFIRMED")}>Accept</button>}
                      {(order.status === "CONFIRMED" || order.status === "PREPARING") && <button className="kot-button kot-button-primary kot-card-action" disabled={busyOrder} onClick={() => void updateStatus(order, "READY")}>Mark ready</button>}
                      {order.status === "READY" && <button className="kot-button kot-button-secondary kot-card-action" disabled={busyOrder} onClick={() => void updateStatus(order, "OUT_FOR_DELIVERY")}>Handed over</button>}
                      <button type="button" className="kot-button kot-button-secondary kot-card-action kot-print-action" disabled={printingOrderId !== null || templateLoading} onClick={() => printBothKotCopies(order)}>{printingOrderId === order.id ? "Printing…" : "Print both"}</button>
                      {order.status === "CANCELLED" && <span className="kot-card-terminal">Cancelled</span>}
                      {(order.status === "OUT_FOR_DELIVERY" || order.status === "DELIVERED") && <span className="kot-card-terminal">Handed over</span>}
                    </div>
                  </div>
                );
              })()}
            </article>
          );
        })}
      </section>

      {selectedOrder && (
        <div
          className="kot-drawer-backdrop"
          role="presentation"
          onClick={(event) => { if (event.target === event.currentTarget) setSelectedOrder(null); }}
        >
          <aside className="kot-detail-drawer" role="dialog" aria-modal="true" aria-labelledby="kot-order-drawer-title">
            <header className="kot-drawer-header">
              <div>
                <div className="kot-order-id-row">
                  <span className={`kot-channel kot-channel-${selectedOrder.channel.toLowerCase()}`}>{channelLabel(selectedOrder.channel)}</span>
                  <span className={`kot-status kot-status-${selectedOrder.status.toLowerCase()}`}>{statusLabel(selectedOrder.status)}</span>
                </div>
                <h2 id="kot-order-drawer-title">{selectedOrder.kotNumber}</h2>
                <p>{timeLabel(selectedOrder.createdAt)} · {selectedOrder.externalOrderId ? `Ref ${selectedOrder.externalOrderId}` : selectedOrder.invoiceNumber}</p>
              </div>
              <button className="kot-button kot-button-quiet" onClick={() => setSelectedOrder(null)} aria-label="Close order details">Close</button>
            </header>
            <div className="kot-detail-grid">
              <div><span className="kot-detail-label">Customer</span><strong>{customerDetails(selectedOrder).name}</strong></div>
              <div><span className="kot-detail-label">Phone</span><strong>{customerDetails(selectedOrder).phone}</strong></div>
              <div><span className="kot-detail-label">Delivery area</span><strong>{customerDetails(selectedOrder).area}, {customerDetails(selectedOrder).city}</strong></div>
              <div><span className="kot-detail-label">Payment</span><strong>{selectedOrder.paymentMethod}</strong></div>
              <div className="kot-detail-wide"><span className="kot-detail-label">Delivery address</span><strong>{customerDetails(selectedOrder).address}</strong></div>
            </div>
            <section className="kot-timing-summary">
              <h3>Kitchen timing record</h3>
              <div className="kot-timing-summary-grid">
                <div><span>Received</span><strong>{dateTimeLabel(selectedOrder.createdAt)}</strong></div>
                <div><span>Accepted</span><strong>{selectedOrder.acceptedAt ? dateTimeLabel(selectedOrder.acceptedAt) : "Not accepted / not recorded"}</strong></div>
                <div><span>Time to accept</span><strong>{selectedOrder.acceptanceDurationSeconds !== null ? formatDuration(selectedOrder.acceptanceDurationSeconds) : selectedOrder.status === "PENDING" ? "Running — see card timer" : selectedOrder.acceptedAt ? "Recorded event; duration unavailable" : "—"}</strong></div>
                <div><span>Ready</span><strong>{selectedOrder.readyAt ? dateTimeLabel(selectedOrder.readyAt) : "Not ready / not recorded"}</strong></div>
                <div><span>Preparation time</span><strong>{selectedOrder.preparationDurationSeconds !== null ? formatDuration(selectedOrder.preparationDurationSeconds) : selectedOrder.status === "CONFIRMED" || selectedOrder.status === "PREPARING" ? "Running — see card timer" : "—"}</strong></div>
                <div><span>{selectedOrder.status === "CANCELLED" ? "Total before cancellation" : "Total received to ready"}</span><strong>{selectedOrder.acceptanceDurationSeconds !== null && selectedOrder.preparationDurationSeconds !== null ? formatDuration(selectedOrder.acceptanceDurationSeconds + selectedOrder.preparationDurationSeconds) : selectedOrder.readyAt ? "Historical duration unavailable" : "—"}</strong></div>
              </div>
              {selectedOrder.handedOverAt && <p>Handed over: {dateTimeLabel(selectedOrder.handedOverAt)}</p>}
              {selectedOrder.cancelledAt && <p>Cancelled: {dateTimeLabel(selectedOrder.cancelledAt)}</p>}
            </section>
            <div className="kot-detail-items">
              <h3>Items</h3>
              {selectedOrder.bowls.map((bowl) => (
                <div className="kot-detail-bowl" key={bowl.id}>
                  <strong>{bowl.quantity} × {bowl.bowlName}</strong>
                  {bowl.details && <pre>{bowl.details}</pre>}
                </div>
              ))}
              {selectedOrder.specialInstructions && <div className="kot-special-instructions"><strong>Special instructions</strong><p>{selectedOrder.specialInstructions}</p></div>}
            </div>
            <div className="kot-order-footer">
              <div className="kot-timeline">
                <h3>Order timeline</h3>
                {(selectedOrder.statusEvents ?? []).filter((event) => event.toStatus !== "PREPARING").length > 0 ? (selectedOrder.statusEvents ?? []).filter((event) => event.toStatus !== "PREPARING").map((event) => (
                  <div className="kot-timeline-event" key={event.id}>
                    <i/><span>{event.fromStatus ? `${statusLabel(event.fromStatus)} → ${statusLabel(event.toStatus)}` : `Order received · ${statusLabel(event.toStatus)}`}</span><time>{dateTimeLabel(event.createdAt)}</time>
                  </div>
                )) : (
                  <p className="kot-helper">Status history is not available for this order in the three-stage kitchen workflow.</p>
                )}
              </div>
              <div className="kot-order-actions">
                <button type="button" className="kot-button kot-button-primary" disabled={printingOrderId !== null || templateLoading} onClick={() => printBothKotCopies(selectedOrder)}>{printingOrderId === selectedOrder.id ? "Printing…" : "Print both copies"}</button>
                <button type="button" className="kot-button kot-button-secondary" disabled={printingOrderId !== null || templateLoading} onClick={() => printKot(selectedOrder, "CUSTOMER")}>Customer receipt</button>
                <button type="button" className="kot-button kot-button-secondary" disabled={printingOrderId !== null || templateLoading} onClick={() => printKot(selectedOrder, "KITCHEN")}>Kitchen ticket</button>
                {selectedOrder.status === "PENDING" && <button className="kot-button kot-button-primary" disabled={busyOrder} onClick={() => void updateStatus(selectedOrder, "CONFIRMED")}>Accept order</button>}
                {(selectedOrder.status === "CONFIRMED" || selectedOrder.status === "PREPARING") && <button className="kot-button kot-button-primary" disabled={busyOrder} onClick={() => void updateStatus(selectedOrder, "READY")}>Mark ready</button>}
                {selectedOrder.status === "READY" && <button className="kot-button kot-button-primary" disabled={busyOrder} onClick={() => void updateStatus(selectedOrder, "OUT_FOR_DELIVERY")}>Handed over</button>}
                {(selectedOrder.status === "PENDING" || selectedOrder.status === "CONFIRMED" || selectedOrder.status === "PREPARING") && <button className="kot-button kot-button-danger" disabled={busyOrder} onClick={() => void updateStatus(selectedOrder, "CANCELLED")}>Cancel order</button>}
                {selectedOrder.status === "OUT_FOR_DELIVERY" && <span className="kot-completion-note">Handed over to delivery partner.</span>}
                {selectedOrder.status === "DELIVERED" && <span className="kot-completion-note">Order completed.</span>}
                {selectedOrder.status === "CANCELLED" && <span className="kot-completion-note">Order cancelled.</span>}
                <div className="kot-total">Order total <strong>₹{selectedOrder.total.toFixed(2)}</strong></div>
                <p className="kot-helper">Accepting an order with Auto-print ON sends both copies: customer receipt first, then kitchen ticket. Manual printing remains available for each copy separately.</p>
              </div>
            </div>
          </aside>
        </div>
      )}

      <footer className="kot-pagination">
        <span>Showing {orders.length ? (page - 1) * 50 + 1 : 0}–{Math.min(page * 50, ordersData?.total ?? 0)} of {ordersData?.total ?? 0}</span>
        <div><button className="kot-button kot-button-secondary" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button><span>Page {page} of {totalPages}</span><button className="kot-button kot-button-secondary" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>Next</button></div>
      </footer>
    </main>
  );
}
