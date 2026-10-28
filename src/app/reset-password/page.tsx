"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import "../login/login.css";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (password !== confirmPassword) {
      setError("Those passwords don’t match.");
      return;
    }

    setSaving(true);
    try {
      const { error: updateError } = await createClient().auth.updateUser({ password });
      if (updateError) throw updateError;
      setMessage("Password saved. You can now sign in with your email and password.");
      setPassword("");
      setConfirmPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn’t save that password. Open the latest reset email and try again.");
    } finally {
      setSaving(false);
    }
  }

  return <main className="auth-page">
    <section className="auth-card">
      <Link className="auth-brand" href="/">◎ Relay<span>Bid</span></Link>
      <div className="eyebrow">CAMPUS PASS-ON</div>
      <h1>Choose a password.</h1>
      <p className="auth-copy">Use at least 8 characters. You’ll use it with your email address next time you sign in.</p>
      <form onSubmit={savePassword}>
        <label htmlFor="new-password">New password</label>
        <input id="new-password" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} required minLength={8} />
        <label htmlFor="confirm-password">Confirm password</label>
        <input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required minLength={8} />
        <button className="auth-submit" type="submit" disabled={saving}>{saving ? "Saving…" : "Save password"}<span>↗</span></button>
        {message && <p className="auth-message" role="status">{message}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
      </form>
      <Link className="auth-back" href="/login">← Back to sign in</Link>
    </section>
  </main>;
}
