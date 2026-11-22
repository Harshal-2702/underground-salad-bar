import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vercel exposes VERCEL_ENV to the build process as "production" or "preview".
// Inject it explicitly because Vite does not expose unprefixed system variables
// through import.meta.env by default.
export default defineConfig({
  plugins: [react()],
  define: {
    __USB_DEPLOYMENT_ENV__: JSON.stringify(process.env.VERCEL_ENV ?? "development"),
  },
});
