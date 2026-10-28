"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseConfig } from "@/lib/supabase/config";
import "./login.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const configured = Boolean(getSupabaseConfig());

  async function sendSignInLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSending(true);

    try {
      const campusDomain = process.env.NEXT_PUBLIC_CAMPUS_EMAIL_DOMAIN?.trim().toLowerCase();
      const submittedEmail = email.trim();
      if (campusDomain && submittedEmail.toLowerCase().split("@").at(-1) !== campusDomain) {
        setError(`Use your @${campusDomain} campus email address.`);
        return;
      }
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: submittedEmail,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (signInError) throw signInError;
      setMessage("Check your email for a sign-in link. It will bring you back to RelayBid.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn’t send a sign-in link. Try again.");
    } finally {
      setSending(false);
    }
  }

  return <main className="auth-page">
    <section className="auth-card">
      <Link className="auth-brand" href="/">◎ Relay<span>Bid</span></Link>
      <div className="eyebrow">CAMPUS PASS-ON</div>
      <h1>Sign in to your campus community.</h1>
      <p className="auth-copy">Get a secure email link to bid on useful finds and pass your own items on to the next student.</p>

      {!configured ? <div className="auth-setup-note"><b>One setup step left</b><p>Connect a Supabase project by copying <code>.env.example</code> to <code>.env.local</code> and adding its project URL and publishable key. Email sign-in will be ready after that.</p></div> : <form onSubmit={sendSignInLink}>
        <label htmlFor="email">Campus email</label>
        <input id="email" type="email" autoComplete="email" placeholder="you@campus.edu" value={email} onChange={event => setEmail(event.target.value)} required />
        <button className="auth-submit" type="submit" disabled={sending}>{sending ? "Sending link…" : "Email me a sign-in link"}<span>↗</span></button>
        {message && <p className="auth-message" role="status">{message}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
      </form>}

      <Link className="auth-back" href="/">← Back to the marketplace</Link>
      <p className="auth-footnote">Use your campus email. Domain verification will be configured when your campus address domain is confirmed.</p>
    </section>
  </main>;
}
