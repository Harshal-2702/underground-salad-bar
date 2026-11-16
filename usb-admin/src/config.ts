const hostname =
  typeof window === "undefined" ? "" : window.location.hostname.toLowerCase();

const isVercelPreview = hostname.endsWith(".vercel.app");

// Vercel Preview deployments must use a dedicated staging API variable.
// They must never fall back to VITE_API_URL, which is reserved for Production/local.
const configuredApiUrl = (
  isVercelPreview
    ? import.meta.env.VITE_PREVIEW_API_URL
    : import.meta.env.VITE_API_URL
)?.trim();

if (!configuredApiUrl) {
  throw new Error(
    isVercelPreview
      ? "VITE_PREVIEW_API_URL is missing. Configure the Preview API URL in Vercel."
      : "VITE_API_URL is missing. Configure the Production API URL in Vercel.",
  );
}

let parsedApiUrl: URL;
try {
  parsedApiUrl = new URL(configuredApiUrl);
} catch {
  throw new Error("The configured API URL is invalid.");
}

if (parsedApiUrl.protocol !== "https:" && hostname !== "localhost" && hostname !== "127.0.0.1") {
  throw new Error("Deployed Admin API URLs must use HTTPS.");
}

if (isVercelPreview && parsedApiUrl.hostname === "usb-api.onrender.com") {
  throw new Error("Safety stop: Vercel Preview cannot connect to the production API.");
}

if (
  hostname === "kitchen.undergroundsaladbar.in" &&
  parsedApiUrl.hostname !== "usb-api.onrender.com"
) {
  throw new Error("Safety stop: the production Kitchen domain must connect to the production API.");
}

export const API_URL = configuredApiUrl.replace(/\/$/, "");
