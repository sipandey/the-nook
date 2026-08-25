import * as Sentry from "@sentry/nextjs";
import { SENTRY_DATA_COLLECTION, scrubBreadcrumb, scrubEvent } from "@/lib/monitoring/sentryOptions";
import { SENTRY_ENABLED } from "@/lib/monitoring/sentryEnabled";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: SENTRY_ENABLED,
  sendDefaultPii: false,
  dataCollection: SENTRY_DATA_COLLECTION,
  beforeBreadcrumb: scrubBreadcrumb,
  beforeSend: scrubEvent,
  // No replayIntegration() call anywhere in this file, deliberately —
  // see the design doc's "No Session Replay" decision. Not "disabled,"
  // never added.
});
