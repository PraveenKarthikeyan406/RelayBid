"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseConfig } from "@/lib/supabase/config";
import "./login.css";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const configured = Boolean(getSupabaseConfig());

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSending(true);

    try {
      const submittedEmail = email.trim();
      const supabase = createClient();
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email: submittedEmail,
          password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (signUpError) throw signUpError;
        setMessage("We sent a confirmation email. Confirm your address, then sign in with your email and password.");
      } else if (mode === "reset") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(submittedEmail, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });
        if (resetError) throw resetError;
        setMessage("If an account exists for that address, a password reset link is on its way.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: submittedEmail, password });
        if (signInError) throw signInError;
        window.location.assign("/");
      }
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "Please try again.";
      if (detail.toLowerCase().includes("email rate limit")) {
        setError("Too many emails have been requested. Wait for the limit to reset before trying again.");
      } else if (mode === "login" && detail.toLowerCase().includes("invalid login credentials")) {
        setError("Email or password is incorrect. If this is an older account, use “Forgot or set password?”.");
      } else {
        setError(detail);
      }
    } finally {
      setSending(false);
    }
  }

  return <main className="auth-page">
    <section className="auth-card">
      <Link className="auth-brand" href="/">◎ Relay<span>Bid</span></Link>
      <div className="eyebrow">CAMPUS PASS-ON</div>
      <h1>{mode === "signup" ? "Join your campus community." : mode === "reset" ? "Set a new password." : "Welcome back."}</h1>
      <p className="auth-copy">{mode === "signup" ? "Create an account to bid on useful finds and pass your own items on." : mode === "reset" ? "We’ll email you a secure link to choose a new password." : "Sign in to bid on useful finds and pass your own items on."}</p>

      {!configured ? <div className="auth-setup-note"><b>One setup step left</b><p>Connect a Supabase project by copying <code>.env.example</code> to <code>.env.local</code> and adding its project URL and publishable key. Campus account sign-up and password sign-in will be ready after that.</p></div> : <form onSubmit={submitAuth}>
        {mode === "signup" && <><label htmlFor="name">Full name</label><input id="name" type="text" autoComplete="name" placeholder="Your name" value={name} onChange={event => setName(event.target.value)} required maxLength={60} /></>}
        <label htmlFor="email">Email address</label>
        <input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} required />
        {mode !== "reset" && <><label htmlFor="password">Password</label><input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder={mode === "signup" ? "At least 8 characters" : "Your password"} value={password} onChange={event => setPassword(event.target.value)} required minLength={mode === "signup" ? 8 : undefined} /></>}
        {mode === "login" && <button className="auth-switch auth-forgot" type="button" onClick={() => { setMode("reset"); setError(""); setMessage(""); }}>Forgot or set password?</button>}
        <button className="auth-submit" type="submit" disabled={sending}>{sending ? "Please wait…" : mode === "signup" ? "Create account" : mode === "reset" ? "Email reset link" : "Sign in"}<span>↗</span></button>
        {message && <p className="auth-message" role="status">{message}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
      </form>}

      {configured && mode !== "reset" && <p className="auth-switch-row">{mode === "signup" ? "Already have an account?" : "New to RelayBid?"} <button className="auth-switch" type="button" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(""); setMessage(""); }}>{mode === "signup" ? "Sign in" : "Create account"}</button></p>}
      {configured && mode === "reset" && <button className="auth-switch auth-back-mode" type="button" onClick={() => { setMode("login"); setError(""); setMessage(""); }}>← Back to sign in</button>}

      <Link className="auth-back" href="/">← Back to the marketplace</Link>
      <p className="auth-footnote">Use an email address you can access. Sign-up requires email confirmation; returning students sign in with their password.</p>
    </section>
  </main>;
}
