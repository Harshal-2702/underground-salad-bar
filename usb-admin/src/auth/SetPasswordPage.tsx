import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthContext";

export default function SetPasswordPage() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await updatePassword(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to set the password. Please request a new email link.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-mark">USB</div>
        <p className="auth-eyebrow">UNDERGROUND SALAD BAR</p>
        <h1>Set your password</h1>
        <p className="auth-description">Choose a password for your invited staff account. Use at least 8 characters.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="new-password">New password</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          <label htmlFor="confirm-password">Confirm password</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? "Saving password…" : "Save password"}
          </button>
        </form>
        <p className="auth-footnote">Keep your password private. Do not share it with kitchen staff.</p>
      </section>
    </main>
  );
}
