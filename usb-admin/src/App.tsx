import { useState } from "react";
import OrdersPage from "../pages/OrdersPage";
import IngredientsPage from "./pages/IngredientsPage";
import PurchasesPage from "./pages/PurchasesPage";
import RecipesPage from "./pages/RecipesPage";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import LoginPage from "./auth/LoginPage";
import SetPasswordPage from "./auth/SetPasswordPage";
import { isSupabaseConfigured } from "./lib/supabase";
import "./auth/auth-extra.css";

function AdminGate() {
  const { session, loading, passwordRecovery, signOut } = useAuth();
  const [activeSection, setActiveSection] = useState<"orders" | "ingredients" | "recipes" | "purchases">("orders");

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

  if (activeSection === "recipes") {
    return (
      <RecipesPage
        accessToken={session.access_token}
        signedInEmail={session.user.email ?? "Staff"}
        onBackToOrders={() => setActiveSection("orders")}
        onSignOut={signOut}
      />
    );
  }
  if (activeSection === "ingredients") {
    return (
      <IngredientsPage
        accessToken={session.access_token}
        signedInEmail={session.user.email ?? "Staff"}
        onBackToOrders={() => setActiveSection("orders")}
        onSignOut={signOut}
      />
    );
  }

  if (activeSection === "purchases") {
    return (
      <PurchasesPage
        accessToken={session.access_token}
        signedInEmail={session.user.email ?? "Staff"}
        onBackToOrders={() => setActiveSection("orders")}
        onSignOut={signOut}
      />
    );
  }

  return (
    <OrdersPage
      accessToken={session.access_token}
      signedInEmail={session.user.email ?? "Staff"}
      onSignOut={signOut}
      onOpenIngredients={() => setActiveSection("ingredients")}
      onOpenRecipes={() => setActiveSection("recipes")}
      onOpenPurchases={() => setActiveSection("purchases")}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AdminGate />
    </AuthProvider>
  );
}
