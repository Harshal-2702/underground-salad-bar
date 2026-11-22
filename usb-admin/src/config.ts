const hostname =
  typeof window === "undefined" ? "" : window.location.hostname.toLowerCase();

// Vercel's VITE_VERCEL_ENV identifies the deployment target at build time.
// A production deployment can be opened on a unique *.vercel.app hostname,
// so the hostname alone must never be used to classify Preview vs Production.
const deploymentEnvironment = (
  import.meta.env.VITE_VERCEL_ENV ?? ""
).trim().toLowerCase();

const isVercelPreview = deploymentEnvironment === "preview";
const isVercelProduction = deploymentEnvironment === "production";
const isVercelDeployment = isVercelPreview || isVercelProduction;
const isVercelHostname = hostname.endsWith(".vercel.app");

if (isVercelHostname && !isVercelDeployment) {
  throw new Error(
    "Unable to identify this Vercel deployment environment. Check that Vercel system environment variables are enabled.",
  );
}

// Vercel Preview builds use the isolated staging API.
// Production builds and local development use the configured primary API.
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

if (isVercelProduction && parsedApiUrl.hostname !== "usb-api.onrender.com") {
  throw new Error("Safety stop: Vercel Production must connect to the production API.");
}

if (
  hostname === "kitchen.undergroundsaladbar.in" &&
  parsedApiUrl.hostname !== "usb-api.onrender.com"
) {
  throw new Error("Safety stop: the production Kitchen domain must connect to the production API.");
}

export const API_URL = configuredApiUrl.replace(/\/$/, "");
