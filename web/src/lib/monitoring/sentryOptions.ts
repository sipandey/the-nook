/**
 * Shared Sentry data-collection policy, imported by every init site
 * (instrumentation-client.ts, sentry.server.config.ts,
 * sentry.edge.config.ts) so it's defined once, not duplicated and left
 * to drift. See docs/plans/2026-08-25-sentry-error-monitoring-design.md
 * for the full "why."
 *
 * `dataCollection`, not `sendDefaultPii`: checked directly against the
 * installed @sentry/core@10.71.0 type definitions (not doc summaries,
 * which missed this) — `sendDefaultPii` is deprecated in this version,
 * and several `dataCollection` categories default to `true`/collecting
 * regardless of `sendDefaultPii`'s value. Most critically,
 * `stackFrameVariables` defaults to `true`: local variable *values* in
 * a crashing function's stack frame, sent as-is. This app holds
 * decrypted journal text in local variables in several places (e.g.
 * write/page.tsx's handleSave() `combined` variable) — a crash while
 * one is in scope would otherwise send the actual plaintext. Every
 * category below is set explicitly; none left to its default.
 */
export const SENTRY_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: false, response: false },
  httpBodies: [] as const,
  urlQueryParams: false,
  databaseQueryData: false,
  stackFrameVariables: false,
  genAI: { inputs: false, outputs: false },
  // frameContextLines intentionally left at its default — surrounding
  // *source code* lines around a crash, not runtime data. This app's
  // own code isn't sensitive; only the data flowing through it is.
};

interface MinimalBreadcrumb {
  category?: string;
  [key: string]: unknown;
}

/**
 * Drops console breadcrumbs entirely — defense against a future
 * console.log (in this codebase or a dependency's) ever touching
 * something sensitive, not a claim that today's code needs it.
 */
export function scrubBreadcrumb<T extends MinimalBreadcrumb>(breadcrumb: T): T | null {
  if (breadcrumb.category === "console") return null;
  return breadcrumb;
}

interface MinimalEvent {
  request?: {
    data?: unknown;
    cookies?: unknown;
    headers?: unknown;
    [key: string]: unknown;
  };
  extra?: Record<string, unknown>;
  [key: string]: unknown;
}

const SENSITIVE_KEY_PATTERN = /passphrase|secret|recovery|text|content|plaintext/i;

/**
 * Second layer beyond SENTRY_DATA_COLLECTION, not a replacement for it:
 * strips request.data/cookies/headers if somehow still present, and
 * redacts any `extra` field whose key matches a known-sensitive
 * pattern — a blunt net against a future mistake, not a claim that
 * today's code passes anything sensitive through `extra` already.
 */
export function scrubEvent<T extends MinimalEvent>(event: T): T {
  if (event.request) {
    const { data: _data, cookies: _cookies, headers: _headers, ...restRequest } = event.request;
    event = { ...event, request: restRequest };
  }
  if (event.extra) {
    const scrubbedExtra: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(event.extra)) {
      scrubbedExtra[key] = SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : value;
    }
    event = { ...event, extra: scrubbedExtra };
  }
  return event;
}
