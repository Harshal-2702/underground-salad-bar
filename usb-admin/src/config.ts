const configuredApiUrl = import.meta.env.VITE_API_URL || "https://usb-api.onrender.com";

export const API_URL = configuredApiUrl.replace(/\/$/, "");
