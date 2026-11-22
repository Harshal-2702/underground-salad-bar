import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { API_URL } from "../src/config.ts";
import "../usb-admin/src/reports.css";

type ReportChannel = "ALL" | "WEBSITE" | "ZOMATO" | "SWIGGY";
type DatePreset = "TODAY" | "YESTERDAY" | "LAST_7" | "LAST_30" | "THIS_MONTH" | "CUSTOM";
type ReportId = "overview" | "sales" | "kitchen" | "purchases" | "inventory" | "audit";
type AnyRecord = Record<string, any>;

type ReportDashboard = {
  filters: { from: string; to: string; channel: ReportChannel };
  generatedAt: string;
  rowLimits: { ordersTruncated: boolean; purchasesTruncated: boolean; orderDetailsSampled?: boolean; purchaseDetailsSampled?: boolean };
  overview: AnyRecord;
  sales: AnyRecord;
  kitchen: AnyRecord;
  purchases: AnyRecord;
  inventory: AnyRecord;
  audit: AnyRecord;
};

type EmailPreference = {
  recipientEmail: string;
  deliveryTime: string;
  selectedReports: ReportId[];
  isEnabled: boolean;
  timeZone: string;
};

const REPORT_OPTIONS: Array<{ id: ReportId; label: string }> = [
  { id: "overview", label: "Business overview" },
  { id: "sales", label: "Sales & orders" },
  { id: "kitchen", label: "Kitchen performance" },
  { id: "purchases", label: "Purchases & expenses" },
  { id: "inventory", label: "Inventory & leftovers" },
  { id: "audit", label: "Business audit & exceptions" },
];

function indiaDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (kind: string) => parts.find((value) => value.type === kind)?.value ?? "";
  return part("year") + "-" + part("month") + "-" + part("day");
}

function shiftDate(dateKey: string, days: number): string {
  const date = new Date(dateKey + "T12:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function previousRange(from: string, to: string): { from: string; to: string } {
  const days = Math.floor((new Date(to + "T00:00:00Z").getTime() - new Date(from + "T00:00:00Z").getTime()) / 86400000) + 1;
  return { from: shiftDate(from, -days), to: shiftDate(from, -1) };
}

function formatMoney(value: unknown): string {
  const number = Number(value ?? 0);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(number)
    : "—";
}

function formatNumber(value: unknown): string {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(number) : "—";
}

function formatDuration(seconds: unknown): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(Number(seconds))) return "—";
  const total = Math.max(0, Math.round(Number(seconds)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  if (hours) return hours + "h " + minutes + "m";
  if (minutes) return minutes + "m " + remainder + "s";
  return remainder + "s";
}

function formatDate(value: unknown): string {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value: unknown): string {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function channelName(value: string): string {
  return value === "WEBSITE" ? "Website" : value === "ZOMATO" ? "Zomato" : value === "SWIGGY" ? "Swiggy" : value;
}

function statusName(value: string): string {
  const names: Record<string, string> = {
    PENDING: "New", CONFIRMED: "Accepted", PREPARING: "Accepted (legacy)",
    READY: "Ready", OUT_FOR_DELIVERY: "Handed over", DELIVERED: "Delivered", CANCELLED: "Cancelled",
  };
  return names[value] ?? value;
}

function changeLabel(current: unknown, previous: unknown): string {
  const now = Number(current ?? 0);
  const before = Number(previous ?? 0);
  if (!Number.isFinite(now) || !Number.isFinite(before)) return "No comparison";
  if (before === 0) return now === 0 ? "No change vs previous period" : "New vs previous period";
  const percent = ((now - before) / Math.abs(before)) * 100;
  const sign = percent > 0 ? "+" : "";
  return sign + percent.toFixed(1) + "% vs previous period";
}

function apiHeaders(accessToken: string): HeadersInit {
  return { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" };
}

async function fetchJson<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { ...apiHeaders(accessToken), ...(init?.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body?.error === "string" ? body.error : "The request could not be completed.";
    throw new Error(message);
  }
  return body as T;
}

/* Create a standards-compliant, uncompressed ZIP container for a genuine .xlsx workbook.
   Using inline strings keeps all cell content literal and avoids formula injection. */
function xmlEscape(value: unknown): string {
  return String(value ?? "").replace(/[&<>"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;",
  })[character] ?? character);
}

type WorkbookSheet = { name: string; rows: unknown[][] };

function columnName(index: number): string {
  let number = index + 1;
  let label = "";
  while (number > 0) {
    const remainder = (number - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    number = Math.floor((number - 1) / 26);
  }
  return label;
}

function sheetXml(rows: unknown[][]): string {
  const rowXml = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const ref = columnName(columnIndex) + (rowIndex + 1);
      if (typeof value === "number" && Number.isFinite(value)) {
        return '<c r="' + ref + '" t="n"' + (rowIndex === 0 ? ' s="1"' : "") + '><v>' + value + "</v></c>";
      }
      if (typeof value === "boolean") {
        return '<c r="' + ref + '" t="b"><v>' + (value ? "1" : "0") + "</v></c>";
      }
      const text = String(value ?? "");
      return '<c r="' + ref + '" t="inlineStr"' + (rowIndex === 0 ? ' s="1"' : "") + '><is><t xml:space="preserve">' + xmlEscape(text) + "</t></is></c>";
    }).join("");
    return '<row r="' + (rowIndex + 1) + '">' + cells + "</row>";
  }).join("");
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    "<sheetData>" + rowXml + "</sheetData></worksheet>";
}

function makeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function uint16(value: number): Uint8Array {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function uint32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function joinBytes(chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}

function zipStore(files: Array<{ name: string; text: string }>): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.text);
    const crc = makeCrc32(data);
    const local = joinBytes([
      uint32(0x04034b50), uint16(20), uint16(0x0800), uint16(0), uint16(0), uint16(0x0021),
      uint32(crc), uint32(data.length), uint32(data.length), uint16(name.length), uint16(0), name, data,
    ]);
    localParts.push(local);
    const central = joinBytes([
      uint32(0x02014b50), uint16(20), uint16(20), uint16(0x0800), uint16(0), uint16(0), uint16(0x0021),
      uint32(crc), uint32(data.length), uint32(data.length), uint16(name.length), uint16(0), uint16(0),
      uint16(0), uint16(0), uint32(0), uint32(offset), name,
    ]);
    centralParts.push(central);
    offset += local.length;
  }
  const centralDirectory = joinBytes(centralParts);
  const end = joinBytes([
    uint32(0x06054b50), uint16(0), uint16(0), uint16(files.length), uint16(files.length),
    uint32(centralDirectory.length), uint32(offset), uint16(0),
  ]);
  return joinBytes([...localParts, centralDirectory, end]);
}

function buildWorkbook(sheets: WorkbookSheet[]): Blob {
  const safeSheets = sheets.map((sheet, index) => ({
    ...sheet,
    name: sheet.name.slice(0, 31) || "Sheet" + (index + 1),
  }));
  const sheetOverrides = safeSheets.map((_, index) =>
    '<Override PartName="/xl/worksheets/sheet' + (index + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
  ).join("");
  const workbookSheets = safeSheets.map((sheet, index) =>
    '<sheet name="' + xmlEscape(sheet.name) + '" sheetId="' + (index + 1) + '" r:id="rId' + (index + 1) + '"/>',
  ).join("");
  const worksheetRels = safeSheets.map((_, index) =>
    '<Relationship Id="rId' + (index + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (index + 1) + '.xml"/>',
  ).join("");
  const files = [
    { name: "[Content_Types].xml", text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheetOverrides + '</Types>' },
    { name: "_rels/.rels", text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: "xl/workbook.xml", text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + workbookSheets + '</sheets></workbook>' },
    { name: "xl/_rels/workbook.xml.rels", text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + worksheetRels + '<Relationship Id="rId' + (safeSheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { name: "xl/styles.xml", text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF244C34"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' },
    ...safeSheets.map((sheet, index) => ({ name: "xl/worksheets/sheet" + (index + 1) + ".xml", text: sheetXml(sheet.rows) })),
  ];
  const bytes = zipStore(files);
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function buildReportSheets(report: ReportDashboard): WorkbookSheet[] {
  const sheets: WorkbookSheet[] = [];
  const o = report.overview;
  sheets.push({ name: "Business Overview", rows: [
    ["Metric", "Value", "Definition"],
    ["Reporting period", report.filters.from + " to " + report.filters.to, "Indian Standard Time"],
    ["Order channel filter", report.filters.channel, "Applies to orders and kitchen metrics"],
    ["Total orders", o.totalOrders, "Includes cancelled orders; row data capped at 5,000 if indicated"],
    ["Non-cancelled orders", o.nonCancelledOrders, "Orders not marked CANCELLED"],
    ["Order value (INR)", o.orderValue, "Recorded total of non-cancelled orders; not confirmed collected cash"],
    ["Average order value (INR)", o.averageOrderValue, "Non-cancelled order value divided by non-cancelled orders"],
    ["Cancelled orders", o.cancelledOrders, "Count of orders marked CANCELLED"],
    ["Cancelled order value (INR)", o.cancelledValue, "Recorded order totals for cancelled orders"],
    ["Delivery charges (INR)", o.deliveryCharges, "Recorded delivery charge on non-cancelled orders"],
    ["Recorded purchase spend (INR)", o.purchaseSpend, "Non-voided purchase lines in selected purchase-date period"],
    ["Average acceptance time (seconds)", o.averageAcceptanceSeconds, "Average where timing was recorded"],
    ["Average preparation time (seconds)", o.averagePreparationSeconds, "Average where timing was recorded"],
    ["Average ready-to-handover (seconds)", o.averageReadyToHandoverSeconds, "Average where both timestamps exist"],
    ["Generated at", report.generatedAt, "Server timestamp"],
  ] });
  sheets.push({ name: "Sales Trend", rows: [
    ["Date", "Orders", "Non-cancelled order value (INR)", "Cancelled orders"],
    ...(report.sales.trend ?? []).map((row: AnyRecord) => [row.date, row.orders, row.orderValue, row.cancelled]),
  ] });
  sheets.push({ name: "Channel Mix", rows: [
    ["Channel", "Orders (incl. cancelled)", "Non-cancelled order value (INR)", "Cancelled orders"],
    ...(report.sales.channelMix ?? []).map((row: AnyRecord) => [row.label, row.count, row.orderValue, row.cancelled]),
  ] });
  sheets.push({ name: "Order Status", rows: [
    ["Current status", "Orders"],
    ...Object.entries(report.sales.statusCounts ?? {}).map(([status, count]) => [statusName(status), count]),
  ] });
  sheets.push({ name: "Order Register", rows: [
    ["Invoice", "KOT", "Created at (IST)", "Channel", "Status", "Order value (INR)", "Delivery charge (INR)", "Payment method", "Delivery area", "Bowl quantity", "Acceptance seconds", "Preparation seconds"],
    ...(report.sales.orders ?? []).map((row: AnyRecord) => [
      row.invoiceNumber, row.kotNumber, formatDateTime(row.createdAt), channelName(row.channel), statusName(row.status),
      row.total, row.deliveryCharge, row.paymentMethod, row.deliveryArea, row.bowlCount, row.acceptanceSeconds, row.preparationSeconds,
    ]),
  ] });
  sheets.push({ name: "Kitchen Channel Ops", rows: [
    ["Channel", "Acceptance avg. seconds", "Acceptance records", "Preparation avg. seconds", "Preparation records", "Ready to handover avg. seconds", "Handover records"],
    ...(report.kitchen.operationsByChannel ?? []).map((row: AnyRecord) => [row.channel, row.averageAcceptanceSeconds, row.acceptanceCount, row.averagePreparationSeconds, row.preparationCount, row.averageReadyToHandoverSeconds, row.handoverCount]),
  ] });
  sheets.push({ name: "Kitchen SLA", rows: [
    ["Stage", "Within threshold", "Amber", "Late", "Unconfigured"],
    ["Acceptance", report.kitchen.acceptanceSla.within, report.kitchen.acceptanceSla.amber, report.kitchen.acceptanceSla.late, report.kitchen.acceptanceSla.unconfigured],
    ["Preparation", report.kitchen.preparationSla.within, report.kitchen.preparationSla.amber, report.kitchen.preparationSla.late, report.kitchen.preparationSla.unconfigured],
    [],
    ["Channel", "Acceptance amber min", "Acceptance late min", "Preparation amber min", "Preparation late min"],
    ...(report.kitchen.timingSettings ?? []).map((row: AnyRecord) => [row.channel, row.acceptanceAmberMinutes, row.acceptanceLateMinutes, row.preparationAmberMinutes, row.preparationLateMinutes]),
    [],
    ["Active order", "Invoice", "Channel", "Status", "Stage", "Elapsed seconds", "Late threshold minutes", "Received at"],
    ...(report.kitchen.activeLateOrders ?? []).map((row: AnyRecord) => [row.kotNumber, row.invoiceNumber, channelName(row.channel), statusName(row.status), row.stage, row.elapsedSeconds, row.lateThresholdMinutes, formatDateTime(row.createdAt)]),
  ] });
  sheets.push({ name: "Longest Preparation", rows: [
    ["KOT", "Invoice", "Channel", "Status", "Preparation seconds", "Received at"],
    ...(report.kitchen.longestPreparation ?? []).map((row: AnyRecord) => [row.kotNumber, row.invoiceNumber, channelName(row.channel), statusName(row.status), row.preparationSeconds, formatDateTime(row.createdAt)]),
  ] });
  sheets.push({ name: "Purchase Trend", rows: [
    ["Purchase date", "Non-voided spend (INR)", "Purchase line count"],
    ...(report.purchases.trend ?? []).map((row: AnyRecord) => [row.date, row.amount, row.lineCount]),
  ] });
  sheets.push({ name: "Purchase Summary", rows: [
    ["Category", "Recorded spend (INR)"],
    ...(report.purchases.byCategory ?? []).map((row: AnyRecord) => [row.label, row.amount]),
    [],
    ["Supplier", "Recorded spend (INR)"],
    ...(report.purchases.bySupplier ?? []).map((row: AnyRecord) => [row.label, row.amount]),
    [],
    ["Ingredient", "Purchase unit", "Quantity (non-voided)", "Recorded spend (INR)", "Weighted average price per purchase unit (INR)"],
    ...(report.purchases.byIngredient ?? []).map((row: AnyRecord) => [row.label, row.unit, row.quantity, row.amount, row.unitPrice]),
  ] });
  sheets.push({ name: "Purchase Lines", rows: [
    ["Reference", "Purchase date", "Supplier", "Invoice", "Category", "Ingredient", "Ingredient code", "Quantity", "Unit", "Line amount (INR)", "Unit price (INR)", "Voided", "Void reason"],
    ...(report.purchases.lines ?? []).map((row: AnyRecord) => [row.reference, row.purchaseDate, row.supplier, row.invoiceNumber, row.category, row.ingredient, row.ingredientCode, row.quantity, row.unit, row.amount, row.unitPrice, row.voided, row.voidReason]),
  ] });
  sheets.push({ name: "Inventory Snapshot", rows: [
    ["Latest stocktake date", report.inventory.latestStocktake?.stocktakeDate ?? "No stocktake recorded"],
    ["Recorded by", report.inventory.latestStocktake?.recordedByName ?? "—"],
    [],
    ["Category", "Ingredient", "Latest quantity", "Base unit", "Previous quantity", "Change"],
    ...(report.inventory.snapshot ?? []).map((row: AnyRecord) => [row.category, row.ingredient, row.quantity, row.unit, row.previousQuantity, row.change]),
  ] });
  sheets.push({ name: "Stocktake History", rows: [
    ["Stocktake date", "Recorded at", "Recorded by", "Recorded email", "Ingredient line count"],
    ...(report.inventory.history ?? []).map((row: AnyRecord) => [formatDate(row.stocktakeDate), formatDateTime(row.createdAt), row.recordedByName, row.recordedByEmail, row._count?.lines ?? 0]),
  ] });
  sheets.push({ name: "Report Notes", rows: [
    ["Topic", "Definition / limitation"],
    ["Order value", "Recorded total of non-cancelled orders; it is not proof of collected cash or accounting revenue."],
    ["Average order value", "Non-cancelled order value divided by non-cancelled order count."],
    ["Purchase spend", "Sum of non-voided purchase line amounts for sheets whose purchase dates fall in the selected period."],
    ["Payment collection", "No payment settlement or collection record is currently available."],
    ["Profit / COGS", "Not calculated; order bowls are not linked to immutable recipe versions and actual ingredient issues."],
    ["Inventory changes", "Compares two stocktake snapshots; not a consumption or wastage calculation."],
    ["Order high-volume safeguard", report.rowLimits.ordersTruncated ? "Order trend, hour and area breakdowns, SLA details and registers use the latest 5,000 order detail rows. Headline order totals, statuses and channel aggregates use full database counts/aggregates." : "No order detail row cap reached for this period."],
    ["Purchase high-volume safeguard", report.rowLimits.purchasesTruncated ? "Purchase spend/category/supplier/ingredient breakdowns and line detail use the latest 5,000 purchase transactions in this period." : "No purchase transaction row cap reached for this period."],
    ["Time zone", "Asia/Kolkata (IST)."],
    ["Currency", "INR."],
  ] });
  sheets.push({ name: "Audit Log", rows: [
    ["Record type", "Reference", "Status / stage", "Channel / actor", "Amount (INR)", "Date", "Reason / note"],
    ...(report.audit.cancelledOrders ?? []).map((row: AnyRecord) => ["Cancelled order", row.kotNumber + " / " + row.invoiceNumber, "Cancelled", channelName(row.channel), row.total, formatDateTime(row.cancelledAt), "Order cancelled"]),
    ...(report.audit.voidedTransactions ?? []).map((row: AnyRecord) => ["Voided purchase", row.reference, "Voided", row.voidedByEmail, row.totalAmount, formatDateTime(row.voidedAt), row.voidReason]),
    ...(report.audit.activeLateOrders ?? []).map((row: AnyRecord) => ["Active kitchen alert", row.kotNumber, row.stage, channelName(row.channel), "", formatDateTime(row.createdAt), "Elapsed " + formatDuration(row.elapsedSeconds)]),
    ...(report.audit.completedOrdersMissingTiming ?? []).map((row: AnyRecord) => ["Missing timing", row.kotNumber, statusName(row.status), channelName(row.channel), "", formatDateTime(row.createdAt), "One or more operational timestamps are unavailable"]),
  ] });
  return sheets;
}

function MetricCard({ label, value, note, tone = "" }: { label: string; value: string; note?: string; tone?: string }) {
  return <article className={"reports-metric " + tone}>
    <span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}
  </article>;
}

function Panel({ id, title, subtitle, children }: { id?: string; title: string; subtitle?: string; children: ReactNode }) {
  return <section className="reports-panel" id={id}>
    <header className="reports-panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></header>
    {children}
  </section>;
}

function BarList({ items, valueKey = "amount", format = "money" }: { items: AnyRecord[]; valueKey?: string; format?: "money" | "number" }) {
  const max = Math.max(1, ...items.map((item) => Number(item[valueKey] ?? 0)));
  if (!items.length) return <p className="reports-empty-inline">No records in this period.</p>;
  return <div className="reports-bar-list">{items.slice(0, 8).map((item, index) => {
    const value = Number(item[valueKey] ?? 0);
    return <div className="reports-bar-row" key={String(item.label ?? item.hour ?? index)}>
      <div><span>{String(item.label ?? item.hour ?? "—")}</span><strong>{format === "money" ? formatMoney(value) : formatNumber(value)}</strong></div>
      <div className="reports-bar-track"><i style={{ width: Math.max(2, (value / max) * 100) + "%" }}/></div>
    </div>;
  })}</div>;
}

function TrendChart({ items }: { items: AnyRecord[] }) {
  const maximum = Math.max(1, ...items.map((item) => Number(item.orders ?? 0)));
  if (!items.length) return <p className="reports-empty-inline">No orders in this period.</p>;
  return <div className="reports-trend">
    <div className="reports-trend-bars" role="img" aria-label="Daily order count">
      {items.map((item) => <div className="reports-trend-column" key={item.date} title={item.date + ": " + item.orders + " orders"}>
        <i style={{ height: Math.max(2, (Number(item.orders ?? 0) / maximum) * 100) + "%" }}/>
      </div>)}
    </div>
    <div className="reports-trend-labels"><span>{items[0].date}</span><span>{items[items.length - 1].date}</span></div>
    <p className="reports-chart-caption">Daily order count. Exact values are available in the Excel Sales Trend sheet.</p>
  </div>;
}

export default function ReportsPage({
  accessToken, signedInEmail, onBackToOrders, onSignOut,
}: {
  accessToken: string; signedInEmail: string; onBackToOrders: () => void; onSignOut: () => Promise<void>;
}) {
  const today = indiaDateKey();
  const [datePreset, setDatePreset] = useState<DatePreset>("TODAY");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [channel, setChannel] = useState<ReportChannel>("ALL");
  const [compare, setCompare] = useState(false);
  const [report, setReport] = useState<ReportDashboard | null>(null);
  const [comparison, setComparison] = useState<ReportDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [email, setEmail] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("09:00");
  const [selectedReports, setSelectedReports] = useState<ReportId[]>(REPORT_OPTIONS.map((item) => item.id));
  const [emailLoading, setEmailLoading] = useState(true);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [exporting, setExporting] = useState(false);
  const requestId = useRef(0);

  const loadDashboard = useCallback(async (silent = false) => {
    const id = ++requestId.current;
    if (silent) setRefreshing(true); else setLoading(true);
    setError("");
    const params = new URLSearchParams({ from, to, channel });
    try {
      const currentPromise = fetchJson<ReportDashboard>(API_URL + "/reports?" + params.toString(), accessToken);
      const previous = previousRange(from, to);
      const previousPromise = compare
        ? fetchJson<ReportDashboard>(API_URL + "/reports?" + new URLSearchParams({ ...previous, channel }).toString(), accessToken)
        : Promise.resolve(null);
      const [current, prior] = await Promise.all([currentPromise, previousPromise]);
      if (id !== requestId.current) return;
      setReport(current);
      setComparison(prior);
      setLastUpdated(new Date());
    } catch (caught) {
      if (id === requestId.current) {
        setError(caught instanceof Error ? caught.message : "Unable to load reports.");
        setReport(null);
        setComparison(null);
      }
    } finally {
      if (id === requestId.current) { setLoading(false); setRefreshing(false); }
    }
  }, [accessToken, channel, compare, from, to]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  useEffect(() => {
    let active = true;
    setEmailLoading(true);
    fetchJson<{ preference: EmailPreference | null }>(API_URL + "/reports/email-settings", accessToken)
      .then(({ preference }) => {
        if (!active || !preference) return;
        setEmail(preference.recipientEmail ?? "");
        setDeliveryTime(preference.deliveryTime ?? "09:00");
        setSelectedReports(Array.isArray(preference.selectedReports) ? preference.selectedReports : REPORT_OPTIONS.map((item) => item.id));
      })
      .catch((caught) => { if (active) setEmailError(caught instanceof Error ? caught.message : "Unable to load email preferences."); })
      .finally(() => { if (active) setEmailLoading(false); });
    return () => { active = false; };
  }, [accessToken]);

  const applyPreset = (preset: DatePreset) => {
    const current = indiaDateKey();
    setDatePreset(preset);
    if (preset === "TODAY") { setFrom(current); setTo(current); }
    if (preset === "YESTERDAY") { const yesterday = shiftDate(current, -1); setFrom(yesterday); setTo(yesterday); }
    if (preset === "LAST_7") { setFrom(shiftDate(current, -6)); setTo(current); }
    if (preset === "LAST_30") { setFrom(shiftDate(current, -29)); setTo(current); }
    if (preset === "THIS_MONTH") { setFrom(current.slice(0, 8) + "01"); setTo(current); }
  };

  const downloadExcel = () => {
    if (!report) return;
    setExporting(true);
    try {
      const workbook = buildWorkbook(buildReportSheets(report));
      const url = URL.createObjectURL(workbook);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "Underground-Kitchen-Report-" + from + "-to-" + to + ".xlsx";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const saveEmailPreferences = async () => {
    setEmailSaving(true); setEmailError(""); setEmailMessage("");
    try {
      await fetchJson(API_URL + "/reports/email-settings", accessToken, {
        method: "PUT",
        body: JSON.stringify({ recipientEmail: email, deliveryTime, selectedReports }),
      });
      setEmailMessage("Preferences saved. Email delivery remains disabled.");
    } catch (caught) {
      setEmailError(caught instanceof Error ? caught.message : "Unable to save email preferences.");
    } finally {
      setEmailSaving(false);
    }
  };

  const totals = report?.overview;
  const orderTrend = report?.sales?.trend ?? [];
  const allOrderRows: AnyRecord[] = report?.sales?.orders ?? [];
  const purchaseLines: AnyRecord[] = report?.purchases?.lines ?? [];
  const purchaseByCategory: AnyRecord[] = report?.purchases?.byCategory ?? [];
  const purchaseBySupplier: AnyRecord[] = report?.purchases?.bySupplier ?? [];
  const purchaseByIngredient: AnyRecord[] = report?.purchases?.byIngredient ?? [];
  const inventoryRows: AnyRecord[] = report?.inventory?.snapshot ?? [];
  const compareMetrics = useMemo(() => {
    if (!comparison || !report) return null;
    return {
      orderValue: changeLabel(report.overview.orderValue, comparison.overview.orderValue),
      orders: changeLabel(report.overview.totalOrders, comparison.overview.totalOrders),
      purchaseSpend: changeLabel(report.overview.purchaseSpend, comparison.overview.purchaseSpend),
    };
  }, [comparison, report]);

  return <main className="reports-shell">
    <header className="reports-header">
      <div className="reports-brand">
        <p className="reports-eyebrow">UNDERGROUND KITCHEN OS</p>
        <h1>Business Reports</h1>
        <p>Sales, kitchen operations, purchases and inventory in one place.</p>
        <small>Signed in as {signedInEmail}</small>
      </div>
      <div className="reports-header-actions">
        <button className="reports-button reports-button-secondary" type="button" onClick={onBackToOrders}>← Kitchen Orders</button>
        <button className="reports-button reports-button-secondary" type="button" onClick={() => void onSignOut()}>Sign out</button>
      </div>
    </header>

    <section className="reports-toolbar">
      <div className="reports-toolbar-heading">
        <div><strong>Report filters</strong><small>All report figures use Indian Standard Time (IST).</small></div>
        <span className="reports-updated">{lastUpdated ? "Updated " + lastUpdated.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }) : "Not refreshed yet"}</span>
      </div>
      <div className="reports-filter-row">
        <select className="reports-input reports-preset" value={datePreset} onChange={(event) => applyPreset(event.target.value as DatePreset)} aria-label="Date range preset">
          <option value="TODAY">Today</option><option value="YESTERDAY">Yesterday</option><option value="LAST_7">Last 7 days</option>
          <option value="LAST_30">Last 30 days</option><option value="THIS_MONTH">This month</option><option value="CUSTOM">Custom range</option>
        </select>
        <label className="reports-date-field"><span>From</span><input className="reports-input" type="date" value={from} max={to} onChange={(event) => { setFrom(event.target.value); setDatePreset("CUSTOM"); }}/></label>
        <label className="reports-date-field"><span>To</span><input className="reports-input" type="date" value={to} min={from} onChange={(event) => { setTo(event.target.value); setDatePreset("CUSTOM"); }}/></label>
        <select className="reports-input reports-channel" value={channel} onChange={(event) => setChannel(event.target.value as ReportChannel)} aria-label="Order channel">
          <option value="ALL">All order channels</option><option value="WEBSITE">Website</option><option value="ZOMATO">Zomato</option><option value="SWIGGY">Swiggy</option>
        </select>
        <label className="reports-compare"><input type="checkbox" checked={compare} onChange={(event) => setCompare(event.target.checked)}/> Compare previous period</label>
        <button type="button" className="reports-button reports-button-secondary" onClick={() => void loadDashboard(true)} disabled={loading || refreshing}>{refreshing ? "Refreshing…" : "↻ Refresh"}</button>
        <button type="button" className="reports-button reports-button-primary" onClick={downloadExcel} disabled={!report || exporting}>{exporting ? "Preparing…" : "↓ Download Excel"}</button>
      </div>
      <p className="reports-filter-note">The channel filter affects sales and kitchen figures. Purchase and stocktake reports show all recorded activity.</p>
    </section>

    <nav className="reports-section-nav" aria-label="Report sections">
      <a href="#overview">Overview</a><a href="#sales">Sales & orders</a><a href="#kitchen">Kitchen</a>
      <a href="#purchases">Purchases</a><a href="#inventory">Inventory</a><a href="#audit">Audit</a><a href="#future">Future reports</a><a href="#email">Email report</a>
    </nav>

    {error && <div className="reports-alert reports-alert-error" role="alert">{error}</div>}
    {loading && !report ? <div className="reports-loading"><span className="reports-spinner"/><strong>Preparing your reports…</strong><p>Reading the selected period from your operational records.</p></div> : null}
    {!loading && !report && <div className="reports-empty"><strong>No report data could be loaded.</strong><p>Check the connection and refresh the report.</p></div>}

    {report && <>
      { (report.rowLimits.ordersTruncated || report.rowLimits.purchasesTruncated) &&
        <div className="reports-alert reports-alert-warning">
          A high-volume safeguard limited some detail rows to the first 5,000 records. The dashboard and Excel export will clearly reflect the returned detail sample; use shorter date ranges for complete detail exports.
        </div>
      }

      <section id="overview" className="reports-section">
        <div className="reports-section-title"><span>01</span><div><h2>Business overview</h2><p>The headline numbers for the selected period.</p></div></div>
        <div className="reports-metric-grid">
          <MetricCard label="Total orders" value={formatNumber(totals.totalOrders)} note={compareMetrics?.orders ?? "Includes cancelled orders"}/>
          <MetricCard label="Order value" value={formatMoney(totals.orderValue)} note={compareMetrics?.orderValue ?? "Non-cancelled recorded orders"}/>
          <MetricCard label="Average order value" value={formatMoney(totals.averageOrderValue)} note="Per non-cancelled order"/>
          <MetricCard label="Cancelled orders" value={formatNumber(totals.cancelledOrders)} note={formatMoney(totals.cancelledValue) + " cancelled order value"} tone="reports-metric-warm"/>
          <MetricCard label="Purchase spend" value={formatMoney(totals.purchaseSpend)} note={compareMetrics?.purchaseSpend ?? "Non-voided purchase lines"}/>
          <MetricCard label="Delivery charges" value={formatMoney(totals.deliveryCharges)} note="Recorded on non-cancelled orders"/>
          <MetricCard label="Avg. acceptance" value={formatDuration(totals.averageAcceptanceSeconds)} note="Only orders with a saved duration"/>
          <MetricCard label="Avg. preparation" value={formatDuration(totals.averagePreparationSeconds)} note="Only orders with a saved duration"/>
        </div>
        <div className="reports-two-columns reports-overview-followup">
          <Panel title="Order trend" subtitle="Daily order volume during the selected period."><TrendChart items={orderTrend}/></Panel>
          <Panel title="Order channels" subtitle="Order counts include cancellations; value excludes cancelled orders.">
            <div className="reports-channel-cards">{(report.sales.channelMix ?? []).map((item: AnyRecord) =>
              <div className="reports-channel-card" key={item.channel}><span>{item.label}</span><strong>{formatNumber(item.count)}</strong><small>{formatMoney(item.orderValue)} order value</small></div>
            )}</div>
            <div className="reports-inline-stat"><span>Ready to handover average</span><strong>{formatDuration(totals.averageReadyToHandoverSeconds)}</strong></div>
          </Panel>
        </div>
      </section>

      <section id="sales" className="reports-section">
        <div className="reports-section-title"><span>02</span><div><h2>Sales & orders</h2><p>Where orders come from, when they arrive, and the detailed order register.</p></div></div>
        <div className="reports-two-columns">
          <Panel title="Busiest hours" subtitle="Order count by hour of day (IST).">
            <BarList items={report.sales.peakHours ?? []} valueKey="count" format="number"/>
          </Panel>
          <Panel title="Top delivery areas" subtitle="Ranked by non-cancelled recorded order value.">
            <BarList items={report.sales.areaMix ?? []}/>
          </Panel>
        </div>
        <div className="reports-two-columns reports-panel-gap">
          <Panel title="Order status breakdown" subtitle="Current status of orders created in the selected period.">
            <div className="reports-status-grid">{Object.entries(report.sales.statusCounts ?? {}).map(([status, count]) =>
              <div key={status}><span>{statusName(status)}</span><strong>{formatNumber(count)}</strong></div>
            )}</div>
          </Panel>
          <Panel title="Cancellations by channel" subtitle="Orders marked cancelled, grouped by source.">
            <div className="reports-status-grid">{(report.sales.cancellationByChannel ?? []).map((item: AnyRecord) =>
              <div key={item.channel}><span>{channelName(item.channel)}</span><strong>{formatNumber(item.cancelled)}</strong></div>
            )}</div>
            <p className="reports-footnote">Bowl descriptions are saved as free text today, so this report does not guess ingredient or menu-item popularity.</p>
          </Panel>
        </div>
        <Panel title="Order register" subtitle="Latest orders in the selected period. Download Excel for the full returned register.">
          <div className="reports-desktop-table">
            <div className="reports-table-scroll"><table><thead><tr><th>Invoice / KOT</th><th>Date & time</th><th>Channel</th><th>Status</th><th>Order value</th><th>Delivery</th><th>Payment method</th><th>Area</th></tr></thead>
              <tbody>{allOrderRows.slice(0, 75).map((row) => <tr key={row.id}>
                <td><strong>{row.invoiceNumber}</strong><small>{row.kotNumber}</small></td><td>{formatDateTime(row.createdAt)}</td><td>{channelName(row.channel)}</td>
                <td><span className={"reports-status-pill " + (row.status === "CANCELLED" ? "is-cancelled" : "")}>{statusName(row.status)}</span></td>
                <td className="reports-number-cell">{formatMoney(row.total)}</td><td>{formatMoney(row.deliveryCharge)}</td><td>{row.paymentMethod}</td><td>{row.deliveryArea ?? "—"}</td>
              </tr>)}</tbody></table></div>
          </div>
          <div className="reports-mobile-records">{allOrderRows.slice(0, 75).map((row) => <article className="reports-record-card" key={row.id}>
            <div><strong>{row.kotNumber}</strong><span className={"reports-status-pill " + (row.status === "CANCELLED" ? "is-cancelled" : "")}>{statusName(row.status)}</span></div>
            <small>{row.invoiceNumber} · {formatDateTime(row.createdAt)}</small>
            <dl><div><dt>Channel</dt><dd>{channelName(row.channel)}</dd></div><div><dt>Order value</dt><dd>{formatMoney(row.total)}</dd></div><div><dt>Delivery</dt><dd>{formatMoney(row.deliveryCharge)}</dd></div><div><dt>Area</dt><dd>{row.deliveryArea ?? "—"}</dd></div></dl>
          </article>)}</div>
          {allOrderRows.length > 75 && <p className="reports-footnote">Showing the first 75 order rows on screen. The Excel workbook contains all returned order rows.</p>}
        </Panel>
      </section>

      <section id="kitchen" className="reports-section">
        <div className="reports-section-title"><span>03</span><div><h2>Kitchen performance</h2><p>Operational speed, configured SLA performance, and current delays.</p></div></div>
        <div className="reports-metric-grid reports-metric-grid-3">
          <MetricCard label="Avg. acceptance time" value={formatDuration(totals.averageAcceptanceSeconds)} note="Received → accepted"/>
          <MetricCard label="Avg. preparation time" value={formatDuration(totals.averagePreparationSeconds)} note="Accepted → ready"/>
          <MetricCard label="Avg. ready to handover" value={formatDuration(totals.averageReadyToHandoverSeconds)} note="Ready → handed over"/>
        </div>
        <div className="reports-two-columns">
          <Panel title="Acceptance SLA" subtitle="Only configured channel thresholds are evaluated.">
            <div className="reports-sla-grid"><div><strong>{report.kitchen.acceptanceSla.within}</strong><span>Within</span></div><div><strong>{report.kitchen.acceptanceSla.amber}</strong><span>Amber</span></div><div><strong>{report.kitchen.acceptanceSla.late}</strong><span>Late</span></div><div><strong>{report.kitchen.acceptanceSla.unconfigured}</strong><span>Unconfigured</span></div></div>
            <p className="reports-footnote">Historical orders without a saved acceptance duration remain unconfigured instead of being estimated.</p>
          </Panel>
          <Panel title="Preparation SLA" subtitle="Measured against the channel-specific timing settings.">
            <div className="reports-sla-grid"><div><strong>{report.kitchen.preparationSla.within}</strong><span>Within</span></div><div><strong>{report.kitchen.preparationSla.amber}</strong><span>Amber</span></div><div><strong>{report.kitchen.preparationSla.late}</strong><span>Late</span></div><div><strong>{report.kitchen.preparationSla.unconfigured}</strong><span>Unconfigured</span></div></div>
            <p className="reports-footnote">The report uses the configured SLA thresholds for each channel.</p>
          </Panel>
        </div>
        <Panel title="Kitchen timing by channel" subtitle="Average saved durations for non-cancelled records in the returned detail set.">\n          <div className="reports-desktop-table"><div className="reports-table-scroll"><table><thead><tr><th>Channel</th><th>Acceptance avg.</th><th>Recorded</th><th>Preparation avg.</th><th>Recorded</th><th>Ready → handover avg.</th></tr></thead><tbody>\n            {(report.kitchen.operationsByChannel ?? []).map((row: AnyRecord) => <tr key={row.channel}><td>{channelName(row.channel)}</td><td>{formatDuration(row.averageAcceptanceSeconds)}</td><td>{formatNumber(row.acceptanceCount)}</td><td>{formatDuration(row.averagePreparationSeconds)}</td><td>{formatNumber(row.preparationCount)}</td><td>{formatDuration(row.averageReadyToHandoverSeconds)}</td></tr>)}\n          </tbody></table></div></div>\n          <div className="reports-mobile-records">{(report.kitchen.operationsByChannel ?? []).map((row: AnyRecord) => <article className="reports-record-card" key={row.channel}>\n            <strong>{channelName(row.channel)}</strong><dl><div><dt>Acceptance avg.</dt><dd>{formatDuration(row.averageAcceptanceSeconds)} ({row.acceptanceCount})</dd></div><div><dt>Preparation avg.</dt><dd>{formatDuration(row.averagePreparationSeconds)} ({row.preparationCount})</dd></div><div><dt>Ready → handover</dt><dd>{formatDuration(row.averageReadyToHandoverSeconds)}</dd></div></dl>\n          </article>)}</div>\n          <p className="reports-footnote">Per-channel timing rows use the latest 5,000 order detail records when that high-volume safeguard is reached.</p>\n        </Panel>\n        <Panel title="Active kitchen alerts" subtitle="Orders currently beyond configured amber or late timing thresholds from the selected-period detail set.">
          {(report.kitchen.activeLateOrders ?? []).length ? <div className="reports-alert-list">{report.kitchen.activeLateOrders.map((row: AnyRecord, index: number) =>
            <article key={row.kotNumber + "-" + row.stage + "-" + index}><div><strong>{row.kotNumber}</strong><span>{row.stage}</span></div><small>{channelName(row.channel)} · {formatDuration(row.elapsedSeconds)} elapsed · threshold {row.lateThresholdMinutes ?? "—"} min</small></article>
          )}</div> : <p className="reports-empty-inline">No active orders are currently beyond configured amber thresholds.</p>}
        </Panel>
        <Panel title="Longest recorded preparation times" subtitle="Completed preparation durations, highest first.">
          <div className="reports-simple-list">{(report.kitchen.longestPreparation ?? []).map((row: AnyRecord) =>
            <div key={row.kotNumber}><span><strong>{row.kotNumber}</strong><small>{channelName(row.channel)} · {statusName(row.status)}</small></span><b>{formatDuration(row.preparationSeconds)}</b></div>
          )}</div>
        </Panel>
      </section>

      <section id="purchases" className="reports-section">
        <div className="reports-section-title"><span>04</span><div><h2>Purchases & expenses</h2><p>Recorded purchasing costs, suppliers, categories and ingredient price history.</p></div></div>
        <div className="reports-metric-grid reports-metric-grid-3">
          <MetricCard label="Recorded purchase spend" value={formatMoney(report.purchases.spend)} note="Non-voided lines by purchase date"/>
          <MetricCard label="Active purchase records" value={formatNumber(report.purchases.transactionCount)} note="Transactions with selected-period sheets"/>
          <MetricCard label="Voided purchase records" value={formatNumber(report.purchases.voidedTransactionCount)} note="Excluded from spend"/>
        </div>
        <div className="reports-two-columns">
          <Panel title="Spend by category" subtitle="Recorded, non-voided purchase lines."><BarList items={purchaseByCategory}/></Panel>
          <Panel title="Spend by supplier" subtitle="Supplier names as entered on purchase sheets."><BarList items={purchaseBySupplier}/></Panel>
        </div>
        <Panel title="Ingredient price history" subtitle="Weighted average per purchase unit for this period; units are kept separate.">
          <div className="reports-desktop-table"><div className="reports-table-scroll"><table><thead><tr><th>Ingredient</th><th>Purchase unit</th><th>Quantity</th><th>Spend</th><th>Average unit price</th></tr></thead><tbody>
            {purchaseByIngredient.map((row: AnyRecord, index: number) => <tr key={row.label + row.unit + index}><td>{row.label}</td><td>{row.unit}</td><td>{formatNumber(row.quantity)}</td><td>{formatMoney(row.amount)}</td><td>{formatMoney(row.unitPrice)}</td></tr>)}
          </tbody></table></div></div>
          <div className="reports-mobile-records">{purchaseByIngredient.slice(0, 75).map((row: AnyRecord, index: number) => <article className="reports-record-card" key={row.label + row.unit + index}>
            <strong>{row.label}</strong><dl><div><dt>Unit</dt><dd>{row.unit}</dd></div><div><dt>Quantity</dt><dd>{formatNumber(row.quantity)}</dd></div><div><dt>Spend</dt><dd>{formatMoney(row.amount)}</dd></div><div><dt>Avg. price</dt><dd>{formatMoney(row.unitPrice)}</dd></div></dl>
          </article>)}</div>
        </Panel>
        <Panel title="Purchase line register" subtitle="Line-level amounts from submitted category sheets.">
          <div className="reports-desktop-table"><div className="reports-table-scroll"><table><thead><tr><th>Reference</th><th>Purchase date</th><th>Supplier</th><th>Category</th><th>Ingredient</th><th>Qty / unit</th><th>Line amount</th><th>Status</th></tr></thead><tbody>
            {purchaseLines.slice(0, 75).map((row, index) => <tr key={row.reference + row.ingredient + index}><td>{row.reference}</td><td>{formatDate(row.purchaseDate)}</td><td>{row.supplier}</td><td>{row.category}</td><td>{row.ingredient}</td><td>{formatNumber(row.quantity)} {row.unit}</td><td>{formatMoney(row.amount)}</td><td>{row.voided ? "Voided" : "Posted"}</td></tr>)}
          </tbody></table></div></div>
          <div className="reports-mobile-records">{purchaseLines.slice(0, 75).map((row, index) => <article className="reports-record-card" key={row.reference + row.ingredient + index}>
            <div><strong>{row.ingredient}</strong><span className={"reports-status-pill " + (row.voided ? "is-cancelled" : "")}>{row.voided ? "Voided" : "Posted"}</span></div>
            <small>{row.reference} · {formatDate(row.purchaseDate)} · {row.supplier}</small>
            <dl><div><dt>Quantity</dt><dd>{formatNumber(row.quantity)} {row.unit}</dd></div><div><dt>Amount</dt><dd>{formatMoney(row.amount)}</dd></div><div><dt>Category</dt><dd>{row.category}</dd></div></dl>
          </article>)}</div>
          {purchaseLines.length > 75 && <p className="reports-footnote">Showing the first 75 purchase lines on screen. The Excel workbook contains all returned lines.</p>}
        </Panel>
      </section>

      <section id="inventory" className="reports-section">
        <div className="reports-section-title"><span>05</span><div><h2>Inventory & leftovers</h2><p>Latest stocktake snapshot and previous recorded stocktake history.</p></div></div>
        {report.inventory.latestStocktake ? <div className="reports-stocktake-banner">
          <div><span>Latest stocktake on or before selected end date</span><strong>{formatDate(report.inventory.latestStocktake.stocktakeDate)}</strong></div>
          <div><span>Recorded by</span><strong>{report.inventory.latestStocktake.recordedByName}</strong></div>
          <div><span>Ingredient records</span><strong>{formatNumber(report.inventory.latestStocktake.lineCount)}</strong></div>
        </div> : <div className="reports-empty-inline reports-empty-card">No stocktake has been recorded on or before the selected end date.</div>}
        <Panel title="Latest recorded quantities" subtitle="Quantity snapshots in each ingredient's base unit; change is versus the preceding stocktake where available.">
          <div className="reports-desktop-table"><div className="reports-table-scroll"><table><thead><tr><th>Category</th><th>Ingredient</th><th>Latest quantity</th><th>Previous quantity</th><th>Recorded change</th></tr></thead><tbody>
            {inventoryRows.map((row, index) => <tr key={row.ingredient + index}><td>{row.category}</td><td>{row.ingredient}</td><td>{formatNumber(row.quantity)} {row.unit}</td><td>{row.previousQuantity === null ? "—" : formatNumber(row.previousQuantity) + " " + row.unit}</td><td>{row.change === null ? "—" : (row.change > 0 ? "+" : "") + formatNumber(row.change) + " " + row.unit}</td></tr>)}
          </tbody></table></div></div>
          <div className="reports-mobile-records">{inventoryRows.slice(0, 100).map((row, index) => <article className="reports-record-card" key={row.ingredient + index}>
            <strong>{row.ingredient}</strong><small>{row.category}</small>
            <dl><div><dt>Latest</dt><dd>{formatNumber(row.quantity)} {row.unit}</dd></div><div><dt>Previous</dt><dd>{row.previousQuantity === null ? "—" : formatNumber(row.previousQuantity) + " " + row.unit}</dd></div><div><dt>Change</dt><dd>{row.change === null ? "—" : (row.change > 0 ? "+" : "") + formatNumber(row.change) + " " + row.unit}</dd></div></dl>
          </article>)}</div>
        </Panel>
        <Panel title="Stocktake history" subtitle="Recorded snapshots within the selected date range.">
          <div className="reports-simple-list">{(report.inventory.history ?? []).map((item: AnyRecord) =>
            <div key={item.id}><span><strong>{formatDate(item.stocktakeDate)}</strong><small>{item.recordedByName} · {formatNumber(item._count?.lines ?? 0)} ingredients</small></span><b>{formatDateTime(item.createdAt)}</b></div>
          )}</div>
          <p className="reports-footnote">Stocktake differences are not labelled as consumption or wastage because there is no continuous stock movement ledger yet.</p>
        </Panel>
      </section>

      <section id="audit" className="reports-section">
        <div className="reports-section-title"><span>06</span><div><h2>Business audit & exceptions</h2><p>Records worth checking, separated from the everyday performance metrics.</p></div></div>
        <div className="reports-two-columns">
          <Panel title="Cancelled orders" subtitle="Recorded orders marked CANCELLED.">
            <div className="reports-simple-list">{(report.audit.cancelledOrders ?? []).slice(0, 30).map((row: AnyRecord) =>
              <div key={row.kotNumber}><span><strong>{row.kotNumber}</strong><small>{row.invoiceNumber} · {channelName(row.channel)}</small></span><b>{formatMoney(row.total)}</b></div>
            )}</div>
            {!report.audit.cancelledOrders?.length && <p className="reports-empty-inline">No cancelled orders.</p>}
          </Panel>
          <Panel title="Voided purchases" subtitle="Excluded from purchase spend but retained here for audit.">
            <div className="reports-simple-list">{(report.audit.voidedTransactions ?? []).slice(0, 30).map((row: AnyRecord) =>
              <div key={row.reference}><span><strong>{row.reference}</strong><small>{row.voidReason || "No reason recorded"} · {row.voidedByEmail || "—"}</small></span><b>{formatMoney(row.totalAmount)}</b></div>
            )}</div>
            {!report.audit.voidedTransactions?.length && <p className="reports-empty-inline">No voided purchases in this period.</p>}
          </Panel>
        </div>
        <Panel title="Active kitchen timing exceptions" subtitle="Currently amber or late orders based on saved SLA thresholds.">
          <div className="reports-simple-list">{(report.audit.activeLateOrders ?? []).map((row: AnyRecord, index: number) =>
            <div key={row.kotNumber + index}><span><strong>{row.kotNumber} · {row.stage}</strong><small>{channelName(row.channel)} · {statusName(row.status)}</small></span><b>{formatDuration(row.elapsedSeconds)}</b></div>
          )}</div>
          {!report.audit.activeLateOrders?.length && <p className="reports-empty-inline">No active exceptions against configured thresholds.</p>}
        </Panel>
        <Panel title="Completed orders with incomplete timing records" subtitle="Historical records that do not contain every operational timestamp needed for timing analysis.">
          <div className="reports-simple-list">{(report.audit.completedOrdersMissingTiming ?? []).slice(0, 50).map((row: AnyRecord) =>
            <div key={row.kotNumber}><span><strong>{row.kotNumber}</strong><small>{channelName(row.channel)} · {statusName(row.status)}</small></span><b>{formatDateTime(row.createdAt)}</b></div>
          )}</div>
          {!report.audit.completedOrdersMissingTiming?.length && <p className="reports-empty-inline">No completed orders with missing timing data in this period.</p>}
        </Panel>
      </section>
    </>}

    <section id="future" className="reports-section">
      <div className="reports-section-title"><span>07</span><div><h2>Food cost & profitability</h2><p>Reserved for the next stage of structured operational data.</p></div></div>
      <div className="reports-future-grid">
        {["Recipe and bowl costing","Food cost percentage","Cost of goods sold","Ingredient consumption","Actual wastage","Gross profit"].map((item) =>
          <div key={item}><span>Coming later</span><strong>{item}</strong></div>
        )}
      </div>
      <p className="reports-footnote">These figures will stay unavailable until orders are linked to immutable recipe versions, purchase units have reliable historical conversions, and actual stock movements / payment collection are recorded.</p>
    </section>

    <section id="email" className="reports-section">
      <div className="reports-section-title"><span>08</span><div><h2>Daily Excel email report</h2><p>Save your preferred recipient, delivery time and report selection for a future scheduled-email feature.</p></div></div>
      <div className="reports-email-panel">
        <div className="reports-email-top"><div><strong>Daily email preferences</strong><p>These settings are saved for later. No email will be generated or sent.</p></div><span className="reports-disabled-pill">NOT ENABLED</span></div>
        {emailLoading ? <p className="reports-empty-inline">Loading saved email preferences…</p> : <div className="reports-email-layout">
          <div className="reports-email-fields">
            <label>Email recipient<input type="email" className="reports-input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" maxLength={255}/></label>
            <label>Daily delivery time (IST)<input type="time" className="reports-input" value={deliveryTime} onChange={(event) => setDeliveryTime(event.target.value)}/></label>
            <div className="reports-email-schedule"><strong>Report period</strong><span>Previous complete day</span><small>Example: Monday at 9:00 AM sends Sunday's report.</small></div>
            <div className="reports-email-schedule"><strong>Attachment format</strong><span>Excel workbook (.xlsx) only</span><small>One workbook with sheets for the report sections selected here.</small></div>
          </div>
          <div className="reports-email-selection"><strong>Include these report sections</strong>
            {REPORT_OPTIONS.map((option) => <label key={option.id}><input type="checkbox" checked={selectedReports.includes(option.id)} onChange={(event) => setSelectedReports((current: ReportId[]) => event.target.checked ? [...current, option.id] : current.filter((id: ReportId) => id !== option.id))}/><span>{option.label}</span></label>)}
            <small>Future food-cost reports will be selectable when accurate calculations are available.</small>
          </div>
        </div>}
        {emailError && <p className="reports-inline-error" role="alert">{emailError}</p>}
        {emailMessage && <p className="reports-inline-success" role="status">{emailMessage}</p>}
        <div className="reports-email-footer"><span>Saved settings do not activate email delivery.</span><button type="button" className="reports-button reports-button-primary" onClick={() => void saveEmailPreferences()} disabled={emailLoading || emailSaving}>{emailSaving ? "Saving…" : "Save email preferences"}</button></div>
      </div>
    </section>

    <footer className="reports-footer"><span>Underground Kitchen OS · Business Reports</span><span>All times IST · Currency INR · Generated from operational records</span></footer>
  </main>;
}
