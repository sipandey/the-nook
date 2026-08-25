"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * The one class of error instrumentation.ts's onRequestError and the
 * browser SDK's automatic instrumentation don't otherwise reach: a
 * React rendering error at the root of the App Router. Deliberately
 * minimal and calm — no stack trace or technical detail shown to the
 * user, matching the tone of this app's other error states (e.g.
 * UnlockGate's "Couldn't reach your journal" message).
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-full flex items-center justify-center bg-background px-6 text-center">
        <p className="text-sm text-muted">
          Something went wrong. Try reloading — nothing about your journal has
          been lost.
        </p>
      </body>
    </html>
  );
}
