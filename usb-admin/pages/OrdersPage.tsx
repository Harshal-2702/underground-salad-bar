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
  showCustomerFirstName: boolean;
  showItems: true;
  showIngredients: boolean;
  showSpecialInstructions: true;
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

const DEFAULT_TEMPLATE: KotTemplateConfig = {
  paperWidth: "80mm",
  headerText: "UNDERGROUND KITCHEN",
  footerText: "Thank you",
  showBrandName: true,
  showLogo: false,
  showKotNumber: true,
  showChannel: true,
  showReceivedAt: true,
  showExternalOrderReference: true,
  showCustomerFirstName: true,
  showItems: true,
  showIngredients: true,
  showSpecialInstructions: true,
  fontSize: 12,
  headingWeight: "bold",
  lineSpacing: "normal",
  margin: "normal",
  alignment: "left",
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

function firstName(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed.split(/\s+/)[0] : "Guest";
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

function buildKotPrintHtml(order: OrderRecord, config: KotTemplateConfig): string {
  const width = config.paperWidth;
  const contentWidth = width === "80mm" ? "72mm" : "48mm";
  const margin = config.margin === "narrow" ? "1mm" : config.margin === "wide" ? "4mm" : "2mm";
  const lineHeight = config.lineSpacing === "compact" ? 1.15 : config.lineSpacing === "relaxed" ? 1.65 : 1.35;
  const customerName = customerDetails(order).name.trim() || "Guest";
  const receivedAt = dateTimeLabel(order.createdAt);
  const rows = order.bowls.map((bowl) => {
    const details = config.showIngredients && bowl.details
      ? `<div class="details">${escapePrintText(bowl.details).replace(/\r?\n/g, "<br>")}</div>`
      : "";
    return `<section class="item">
      <div class="item-heading"><strong>${escapePrintText(String(bowl.quantity))} × ${escapePrintText(bowl.bowlName)}</strong></div>
      ${details}
    </section>`;
  }).join("");
  const brand = config.showBrandName && config.headerText.trim()
    ? `<div class="brand">${escapePrintText(config.headerText.trim())}</div>`
    : "";
  const externalReference = config.showExternalOrderReference && order.externalOrderId
    ? `<div class="meta">External ref: ${escapePrintText(order.externalOrderId)}</div>`
    : "";
  const customer = config.showCustomerFirstName
    ? `<div class="meta">Customer: ${escapePrintText(customerName)}</div>`
    : "";
  const instructions = order.specialInstructions?.trim()
    ? `<section class="special"><strong>Special instructions</strong><div>${escapePrintText(order.specialInstructions).replace(/\r?\n/g, "<br>")}</div></section>`
    : "";
  const footer = config.footerText.trim()
    ? `<div class="footer">${escapePrintText(config.footerText.trim())}</div>`
    : "";
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapePrintText(order.kotNumber)}</title>
<style>
  @page { size: ${width} auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body { width: ${contentWidth}; padding: ${margin}; font-family: Arial, Helvetica, sans-serif; font-size: ${config.fontSize}px; line-height: ${lineHeight}; font-weight: ${config.headingWeight === "bold" ? 600 : 400}; }
  .brand { text-align: ${config.alignment}; font-size: 1.15em; font-weight: 800; margin-bottom: 3mm; overflow-wrap: anywhere; }
  .kot { text-align: ${config.alignment}; font-size: 1.55em; font-weight: 900; letter-spacing: .3px; margin-bottom: 1mm; }
  .meta { font-size: .9em; margin: .7mm 0; overflow-wrap: anywhere; }
  .rule { border-top: 1px dashed #000; margin: 2.2mm 0; }
  .item { padding: 1.4mm 0; border-bottom: 1px dashed #999; break-inside: avoid; }
  .item-heading { font-size: 1.06em; font-weight: 800; overflow-wrap: anywhere; }
  .details { margin-top: 1mm; padding-left: 2mm; font-size: .92em; font-weight: 400; overflow-wrap: anywhere; }
  .special { margin-top: 2.5mm; padding: 2mm; border: 1px solid #000; font-size: .96em; overflow-wrap: anywhere; }
  .special strong { display: block; text-transform: uppercase; margin-bottom: 1mm; }
  .footer { text-align: center; border-top: 1px dashed #000; margin-top: 3mm; padding-top: 2mm; font-size: .85em; overflow-wrap: anywhere; }
  @media screen { body { margin: 8px auto; outline: 1px dashed #bbb; } }
</style></head><body>
  ${brand}
  <div class="kot">${escapePrintText(order.kotNumber)}</div>
  <div class="rule"></div>
  <div class="meta"><strong>Source:</strong> ${escapePrintText(channelLabel(order.channel))}</div>
  <div class="meta"><strong>Received:</strong> ${escapePrintText(receivedAt)}</div>
  ${externalReference}
  ${customer}
  <div class="rule"></div>
  ${rows || "<div>No items</div>"}
  ${instructions}
  ${footer}
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
    total: 0,
    paymentMethod: "TEST",
    createdAt: new Date().toISOString(),
    deliveryName: "Sample Customer",
    deliveryPhone: null,
    deliveryAddress: null,
    deliveryArea: null,
    deliveryCity: null,
    specialInstructions: "Please keep the dressing separate.",
    customer: null,
    bowls: [{
      id: "sample-bowl",
      bowlName: "Continental Bowl",
      quantity: 1,
      price: 0,
      details: ["Rice", "Grilled chicken", "Roasted vegetables", "Pesto dressing"].join("\n"),
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

  const [templateData, setTemplateData] = useState<KotTemplateResponse | null>(null);
  const [templateConfig, setTemplateConfig] = useState<KotTemplateConfig>(DEFAULT_TEMPLATE);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateError, setTemplateError] = useState("");
  const [templateNotice, setTemplateNotice] = useState("");
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
      const response = await fetch(`${API_URL}/kot/templates`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = await response.json().catch(() => null);
      if (response.status === 401) {
        await onSignOut();
        throw new Error("Your session expired. Please sign in again.");
      }
      if (!response.ok) {
        throw new Error(payload && typeof payload.error === "string" ? payload.error : `Template request failed (${response.status}).`);
      }
      const data = payload as KotTemplateResponse;
      setTemplateData(data);
      setTemplateConfig(data.current.config ?? DEFAULT_TEMPLATE);
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : "Unable to load KOT designer.");
    } finally {
      setTemplateLoading(false);
    }
  }, [accessToken, onSignOut]);

  useEffect(() => {
    void loadTemplate();
  }, [loadTemplate]);

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

  const printKot = (order: OrderRecord) => {
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
      printWindow.document.write(buildKotPrintHtml(order, templateConfig));
      printWindow.document.close();
      printWindow.addEventListener("afterprint", () => {
        printWindow.close();
        setPrintingOrderId(null);
      }, { once: true });
      window.setTimeout(() => {
        if (!printWindow.closed) {
          printWindow.focus();
          printWindow.print();
          setPrintNotice(`Print dialog opened for ${order.kotNumber}. Choose DCode DCRP30 and confirm the paper output.`);
          window.setTimeout(() => setPrintingOrderId((current) => current === order.id ? null : current), 60000);
        }
      }, 600);
    } catch (error) {
      printWindow.close();
      setPrintingOrderId(null);
      setPrintError(error instanceof Error ? error.message : "Unable to open the KOT print dialog.");
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
      setAutoPrintNotice(`Auto-print sent ${order.kotNumber} to the Windows default printer.`);
    } catch {
      setAutoPrintNotice(`Auto-print sent ${order.kotNumber}, but this browser could not persist duplicate-print history. Keep this tab open for the current session.`);
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
        reservedWindow.document.write(buildKotPrintHtml(order, templateConfig));
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
      printDocument.write(buildKotPrintHtml(order, templateConfig));
      printDocument.close();

      window.setTimeout(() => {
        try {
          if (!frame.contentWindow) throw new Error("The KOT print frame is no longer available.");
          frame.contentWindow.focus();
          frame.contentWindow.print();

          if (!sample) {
            recordAutoPrintSuccess(order);
          } else {
            setAutoPrintNotice("Sample KOT sent to the Windows default printer.");
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
        body: JSON.stringify({ config: templateConfig }),
      });
      const payload = await response.json().catch(() => null);
      if (response.status === 401) {
        await onSignOut();
        throw new Error("Your session expired. Please sign in again.");
      }
      if (!response.ok) {
        throw new Error(payload && typeof payload.error === "string" ? payload.error : `Template save failed (${response.status}).`);
      }
      setTemplateNotice(`KOT template v${payload.versionNumber} saved. Existing orders and historical template versions are unchanged.`);
      await loadTemplate();
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : "Unable to save KOT template.");
    } finally {
      setTemplateSaving(false);
    }
  };

  const resetTemplate = () => {
    setTemplateConfig(DEFAULT_TEMPLATE);
    setTemplateNotice("Default settings loaded in the preview. Save to create a new template version.");
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
            <p className="kot-muted">Use the Windows driver for manual or silent printing. Silent mode requires the dedicated Chrome --kiosk-printing shortcut.</p>
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
                <div><h2>Template settings</h2><p>Changes appear in the preview before you save.</p></div>
                <span className="kot-version-pill">Current v{templateData?.current.versionNumber ?? 0}</span>
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

              <h3 className="kot-subheading">Content visibility</h3>
              <div className="kot-toggle-list">
                <label><span>Brand name</span><input type="checkbox" checked={templateConfig.showBrandName} onChange={(event) => setTemplateConfig((value) => ({ ...value, showBrandName: event.target.checked }))}/></label>
                <label><span>External order reference</span><input type="checkbox" checked={templateConfig.showExternalOrderReference} onChange={(event) => setTemplateConfig((value) => ({ ...value, showExternalOrderReference: event.target.checked }))}/></label>
                <label><span>Customer first name only</span><input type="checkbox" checked={templateConfig.showCustomerFirstName} onChange={(event) => setTemplateConfig((value) => ({ ...value, showCustomerFirstName: event.target.checked }))}/></label>
                <label><span>Ingredient details</span><input type="checkbox" checked={templateConfig.showIngredients} onChange={(event) => setTemplateConfig((value) => ({ ...value, showIngredients: event.target.checked }))}/></label>
                <label className="is-locked"><span>KOT number <small>Required</small></span><input type="checkbox" checked disabled/></label>
                <label className="is-locked"><span>Order source <small>Required</small></span><input type="checkbox" checked disabled/></label>
                <label className="is-locked"><span>Received time <small>Required</small></span><input type="checkbox" checked disabled/></label>
                <label className="is-locked"><span>Items and quantities <small>Required</small></span><input type="checkbox" checked disabled/></label>
                <label className="is-locked"><span>Special instructions <small>Required</small></span><input type="checkbox" checked disabled/></label>
              </div>
              <p className="kot-helper">Customer phone numbers, addresses and payment details are never included on KOT tickets. A logo upload is not included yet because the Admin project does not currently contain an approved Underground logo asset.</p>

              <div className="kot-form-actions">
                <button type="button" className="kot-button kot-button-secondary" onClick={resetTemplate}>Restore default</button>
                <button type="submit" className="kot-button kot-button-primary" disabled={templateSaving}>{templateSaving ? "Saving…" : "Save new version"}</button>
              </div>
            </section>

            <section className="kot-preview-column">
              <div className="kot-panel">
                <div className="kot-panel-heading"><div><h2>Live preview</h2><p>Sample data only — no real order is changed.</p></div><span className="kot-preview-tag">PREVIEW</span></div>
                <div className="kot-paper-stage">
                  <article className={`kot-paper kot-paper-${templateConfig.paperWidth === "80mm" ? "80" : "58"} kot-paper-margin-${templateConfig.margin} kot-paper-heading-${templateConfig.headingWeight}`} style={{ fontSize: `${templateConfig.fontSize}px`, lineHeight: templateConfig.lineSpacing === "compact" ? 1.2 : templateConfig.lineSpacing === "relaxed" ? 1.65 : 1.4, textAlign: templateConfig.alignment }}>
                    {templateConfig.showBrandName && <div className="kot-paper-brand">{templateConfig.headerText || "UNDERGROUND KITCHEN"}</div>}
                    {templateConfig.showKotNumber && <div className="kot-paper-number">KOT-20261111-001</div>}
                    {templateConfig.showChannel && <div className="kot-paper-meta">WEBSITE · 09:42 AM</div>}
                    {templateConfig.showExternalOrderReference && <div className="kot-paper-meta">ORDER #128</div>}
                    {templateConfig.showCustomerFirstName && <div className="kot-paper-meta">CUSTOMER: HARSHAL</div>}
                    <div className="kot-paper-rule"/>
                    {templateConfig.showItems && <>
                      <div className="kot-paper-item-title">2 × MEXICAN CHICKEN BOWL</div>
                      {templateConfig.showIngredients && <div className="kot-paper-details">BASE: Rice<br/>PROTEIN: Chicken<br/>VEGGIES: Lettuce, Corn, Onion<br/>DRESSING: Chipotle</div>}
                    </>}
                    <div className="kot-paper-rule"/>
                    <div className="kot-paper-special">SPECIAL INSTRUCTIONS<br/>Extra dressing on the side.</div>
                    {templateConfig.footerText && <div className="kot-paper-footer">{templateConfig.footerText}</div>}
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
                <button type="button" className="kot-button kot-button-primary kot-print-sample" onClick={() => autoPrintEnabled ? printKotAutomatically(sampleKotOrder(), true) : printKot(sampleKotOrder())} disabled={printingOrderId !== null || templateLoading}>
                  {printingOrderId === "sample-kot" ? "Sending sample…" : autoPrintEnabled ? "Print sample KOT silently" : "Print sample KOT"}
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
                  <div className="kot-order-customer">{firstName(customer.name)} <span>· {timeLabel(order.createdAt)}</span></div>
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
                      <button type="button" className="kot-button kot-button-secondary kot-card-action kot-print-action" disabled={printingOrderId !== null || templateLoading} onClick={() => printKot(order)}>{printingOrderId === order.id ? "Printing…" : "Print KOT"}</button>
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
                <button type="button" className="kot-button kot-button-secondary" disabled={printingOrderId !== null || templateLoading} onClick={() => printKot(selectedOrder)}>{printingOrderId === selectedOrder.id ? "Printing…" : "Print KOT"}</button>
                {selectedOrder.status === "PENDING" && <button className="kot-button kot-button-primary" disabled={busyOrder} onClick={() => void updateStatus(selectedOrder, "CONFIRMED")}>Accept order</button>}
                {(selectedOrder.status === "CONFIRMED" || selectedOrder.status === "PREPARING") && <button className="kot-button kot-button-primary" disabled={busyOrder} onClick={() => void updateStatus(selectedOrder, "READY")}>Mark ready</button>}
                {selectedOrder.status === "READY" && <button className="kot-button kot-button-primary" disabled={busyOrder} onClick={() => void updateStatus(selectedOrder, "OUT_FOR_DELIVERY")}>Handed over</button>}
                {(selectedOrder.status === "PENDING" || selectedOrder.status === "CONFIRMED" || selectedOrder.status === "PREPARING") && <button className="kot-button kot-button-danger" disabled={busyOrder} onClick={() => void updateStatus(selectedOrder, "CANCELLED")}>Cancel order</button>}
                {selectedOrder.status === "OUT_FOR_DELIVERY" && <span className="kot-completion-note">Handed over to delivery partner.</span>}
                {selectedOrder.status === "DELIVERED" && <span className="kot-completion-note">Order completed.</span>}
                {selectedOrder.status === "CANCELLED" && <span className="kot-completion-note">Order cancelled.</span>}
                <div className="kot-total">Order total <strong>₹{selectedOrder.total.toFixed(2)}</strong></div>
                <p className="kot-helper">Print KOT opens the Windows print dialog. Choose DCode DCRP30. Automatic printing remains off.</p>
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
