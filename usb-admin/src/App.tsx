import { useState } from "react";
import OrdersPage from "../pages/OrdersPage";
import IngredientsPage from "./pages/IngredientsPage";
import PurchasesPage from "./pages/PurchasesPage";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import LoginPage from "./auth/LoginPage";
import SetPasswordPage from "./auth/SetPasswordPage";
import { isSupabaseConfigured } from "./lib/supabase";
import "./auth/auth-extra.css";

function AdminGate() {
  const { session, loading, passwordRecovery, signOut } = useAuth();
  const [activeSection, setActiveSection] = useState<"orders" | "ingredients" | "purchases">("orders");

  if (!isSupabaseConfigured) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>Admin configuration required</h1>
          <p className="auth-description">
            Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to usb-admin/.env.local, then restart the admin app.
          </p>
        </section>
      </main>
    );
  }

  if (loading) {
    return <main className="auth-shell"><p>Checking staff session…</p></main>;
  }

  if (passwordRecovery) {
    if (session) return <SetPasswordPage />;
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>Password link not active</h1>
          <p className="auth-description">The password link may have expired or already been used. Return to login and request a new password email.</p>
          <a href="/" className="auth-link">Return to login</a>
        </section>
      </main>
    );
  }

  if (!session) return <LoginPage />;

  const accessToken = session.access_token;
  const signedInEmail = session.user.email ?? "Staff";

  if (activeSection === "ingredients") {
    return <IngredientsPage accessToken={accessToken} signedInEmail={signedInEmail} onBackToOrders={() => setActiveSection("orders")} onSignOut={signOut} />;
  }

  if (activeSection === "purchases") {
    return <PurchasesPage accessToken={accessToken} signedInEmail={signedInEmail} onBackToOrders={() => setActiveSection("orders")} onSignOut={signOut} />;
  }

  return (
    <>
      <nav style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, padding: "12px 30px", borderBottom: "1px solid #e5e7eb", background: "#fff" }}>
        <strong style={{ marginRight: "auto", color: "#1f3d2b" }}>UNDERGROUND KITCHEN OS</strong>
        <button type="button" onClick={() => setActiveSection("ingredients")} style={{ padding: "9px 13px", border: "1px solid #d5ddd4", borderRadius: 8, background: "#fff", color: "#1f3d2b", fontWeight: 700, cursor: "pointer" }}>Ingredients</button>
        <button type="button" onClick={() => setActiveSection("purchases")} style={{ padding: "9px 13px", border: "1px solid #d5ddd4", borderRadius: 8, background: "#fff", color: "#1f3d2b", fontWeight: 700, cursor: "pointer" }}>Purchases</button>
      </nav>
      <OrdersPage accessToken={accessToken} signedInEmail={signedInEmail} onSignOut={signOut} />
    </>
  );
}

export default function App() {
  return <AuthProvider><AdminGate /></AuthProvider>;
}
