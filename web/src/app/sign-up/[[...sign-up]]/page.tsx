"use client";

/**
 * Custom-styled signup — not Clerk's prebuilt <SignUp/> component (that's
 * still what src/app/sign-in/ uses; this is intentionally the one screen
 * that got the "editorial" visual treatment, per the pasted mockup). Built
 * on Clerk's useSignUp hook so it's a real flow, not a facade: email/
 * password + OAuth, and an email verification-code step that isn't in the
 * mockup but that Clerk requires by default — skipping it would make this
 * screen non-functional.
 *
 * Uses Clerk's newer "Future" resource API (signUp.password(), .sso(),
 * .verifications.*, .finalize()) — this SDK version replaced the classic
 * signUp.create()/setActive() pattern. Don't assume the older shape;
 * see @clerk/shared's signUpFuture.d.ts if this drifts again.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";
import { MaterialIcon } from "@/components/MaterialIcon";

export default function SignUpPage() {
  const { signUp } = useSignUp();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"form" | "verify">("form");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finalizeIfComplete() {
    if (signUp.status === "complete") {
      await signUp.finalize();
      router.push("/");
      return true;
    }
    return false;
  }

  async function handleOAuth(strategy: "oauth_google" | "oauth_apple") {
    setError(null);
    const { error: ssoError } = await signUp.sso({
      strategy,
      redirectUrl: "/",
      redirectCallbackUrl: "/sso-callback",
    });
    if (ssoError) setError("Couldn't start that sign-up. Try again.");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { error: passwordError } = await signUp.password({
        emailAddress: email,
        password,
      });
      if (passwordError) {
        setError("Couldn't create your account. Check your details and try again.");
        return;
      }

      if (await finalizeIfComplete()) return;

      const { error: codeError } = await signUp.verifications.sendEmailCode();
      if (codeError) {
        setError("Couldn't send a verification code. Try again.");
        return;
      }
      setStage("verify");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code });
      if (verifyError) {
        setError("That code didn't work. Try again.");
        return;
      }
      if (!(await finalizeIfComplete())) {
        setError("Something's still missing on our end — try signing in instead.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="font-editorial-sans bg-background text-on-background min-h-screen w-full flex flex-col items-center justify-center antialiased p-6 relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none z-0 opacity-30 bg-cover bg-top"
        style={{ backgroundImage: "url('/images/hero-dawn.jpg')" }}
      />
      <main className="relative z-10 w-full max-w-md flex flex-col gap-stack-gap">
        <header className="flex flex-col items-center text-center gap-2">
          <h1 className="font-editorial-display text-headline-lg-mobile md:text-display-lg text-primary tracking-tight">
            The Nook
          </h1>
          <p className="text-body-lg text-on-surface-variant">A private space for your story.</p>
        </header>

        {stage === "form" && (
          <>
            <div className="bg-surface-container rounded-2xl p-container-padding flex flex-col gap-6 shadow-[0_4px_24px_rgba(74,101,78,0.05)] border border-surface-container-high/50">
              <form onSubmit={handleCreate} className="flex flex-col gap-6">
                <div className="flex flex-col gap-1">
                  <label htmlFor="email" className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="hello@example.com"
                    required
                    className="w-full py-2 bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 text-body-lg text-on-surface placeholder:text-outline-variant transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="password" className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="w-full py-2 bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 text-body-lg text-on-surface placeholder:text-outline-variant transition-colors"
                  />
                </div>

                {error && <p className="text-sm text-error">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-primary hover:bg-on-primary-fixed-variant text-on-primary text-label-sm py-4 rounded-full transition-all shadow-[0_8px_16px_rgba(74,101,78,0.1)] active:scale-[0.98] mt-2 disabled:opacity-50"
                >
                  {submitting ? "Entering…" : "Create Account"}
                </button>
              </form>

              <div className="flex items-center gap-4 py-2">
                <div className="h-px bg-outline-variant/50 flex-1" />
                <span className="text-label-sm text-outline uppercase">Or</span>
                <div className="h-px bg-outline-variant/50 flex-1" />
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => handleOAuth("oauth_google")}
                  className="w-full bg-transparent border border-outline-variant hover:border-primary text-on-surface text-body-md py-3 rounded-full flex justify-center items-center gap-3 transition-colors hover:bg-surface-container-low"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </button>
                <button
                  type="button"
                  onClick={() => handleOAuth("oauth_apple")}
                  className="w-full bg-transparent border border-outline-variant hover:border-primary text-on-surface text-body-md py-3 rounded-full flex justify-center items-center gap-3 transition-colors hover:bg-surface-container-low"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8.94-.11 1.84-.79 3.14-.71 1.31.09 2.31.62 2.95 1.6-2.7 1.61-2.26 5.13.66 6.44-.5 1.48-1.19 2.98-1.83 4.84zM12.03 7.25c-.15-2.23 1.66-4.09 3.74-4.25.28 2.4-2.17 4.24-3.74 4.25z" />
                  </svg>
                  Continue with Apple
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4">
              <p className="text-body-md text-on-surface-variant">
                Already have an account?{" "}
                <a href="/sign-in" className="text-primary hover:text-on-primary-fixed-variant underline underline-offset-4">
                  Sign in
                </a>
              </p>
              <div className="flex items-center gap-2 text-outline-variant">
                <MaterialIcon name="lock" filled size={14} />
                <span className="text-label-sm uppercase tracking-wider">End-to-End Encrypted</span>
              </div>
            </div>
          </>
        )}

        {stage === "verify" && (
          <div className="bg-surface-container rounded-2xl p-container-padding flex flex-col gap-6 shadow-[0_4px_24px_rgba(74,101,78,0.05)] border border-surface-container-high/50">
            <form onSubmit={handleVerify} className="flex flex-col gap-6">
              <p className="text-body-md text-on-surface-variant">
                We sent a code to <span className="text-on-surface font-medium">{email}</span>.
              </p>
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Verification code"
                required
                autoFocus
                className="w-full py-2 bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 text-body-lg text-on-surface placeholder:text-outline-variant tracking-widest transition-colors"
              />
              {error && <p className="text-sm text-error">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary text-on-primary text-label-sm py-4 rounded-full hover:bg-on-primary-fixed-variant transition-all disabled:opacity-50"
              >
                {submitting ? "Verifying…" : "Verify & continue"}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
