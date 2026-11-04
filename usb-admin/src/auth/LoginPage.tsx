import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthContext";

export default function LoginPage() {
  const { signIn, sendPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasswordSetup() {
    setError("");
    setMessage("");
    if (!email.trim()) {
      setError("Enter your invited email address first.");
      return;
    }

    setSubmitting(true);
    try {
      await sendPasswordReset(email.trim());
      setMessage("Password setup email requested. Check your inbox and spam folder, then open the latest email on this device.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send the password setup email. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-mark">USB</div>
        <p className="auth-eyebrow">UNDERGROUND SALAD BAR</p>
        <h1>Kitchen dashboard</h1>
        <p className="auth-description">Sign in with your invited staff account to manage orders.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="staff-email">Email address</label>
          <input
            id="staff-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            required
          />

          <label htmlFor="staff-password">Password</label>
          <input
            id="staff-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            required
          />

          {error && <p className="auth-error" role="alert">{error}</p>}
          {message && <p className="auth-success" role="status">{message}</p>}

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? "Please wait…" : "Sign in"}
          </button>
          <button
            className="auth-secondary"
            type="button"
            onClick={handlePasswordSetup}
            disabled={submitting}
          >
            {submitting ? "Please wait…" : "Set / reset my password"}
          </button>
        </form>

        <p className="auth-footnote">Access is invitation-only. Use the email address that was invited by the owner.</p>
      </section>
    </main>
  );
}
