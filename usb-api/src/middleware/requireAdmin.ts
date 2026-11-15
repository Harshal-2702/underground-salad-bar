import type { RequestHandler } from "express";
import { supabase } from "../services/supabase.js";

/**
 * Protects staff-only API endpoints.
 * A valid Supabase login is not sufficient by itself: the user's email must
 * also appear in ADMIN_ALLOWED_EMAILS on the API server.
 */
export const requireAdmin: RequestHandler = async (req, res, next) => {
  const authorization = req.header("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const accessToken = match?.[1]?.trim();

  if (!accessToken) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const allowedEmails = new Set(
    (process.env.ADMIN_ALLOWED_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );

  // Fail closed: never expose staff endpoints if the allowlist is not configured.
  if (allowedEmails.size === 0) {
    res.status(503).json({ error: "Staff access is not configured." });
    return;
  }

  try {
    // getUser(token) verifies the token against the Supabase Auth server.
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data.user) {
      res.status(401).json({ error: "Your session is invalid or has expired." });
      return;
    }

    const email = data.user.email?.trim().toLowerCase();
    if (!email || !allowedEmails.has(email)) {
      res.status(403).json({ error: "This account is not authorised for kitchen access." });
      return;
    }

    // Expose the verified staff identity to audited purchase operations.
    res.locals.adminEmail = email;
    next();
  } catch {
    // Do not log access tokens or return provider internals to the browser.
    res.status(401).json({ error: "Unable to verify your session. Please sign in again." });
  }
};
