const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

// Never silently send a Vercel Preview to the live production API.
// Configure VITE_API_URL separately for Production and each Preview branch.
if (!configuredApiUrl) {
  throw new Error(
    "VITE_API_URL is missing. Configure the API URL for this Vercel environment.",
  );
}

export const API_URL = configuredApiUrl.replace(/\/$/, "");
