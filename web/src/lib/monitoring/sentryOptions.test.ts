import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/core";
import { SENTRY_DATA_COLLECTION, scrubBreadcrumb, scrubEvent } from "./sentryOptions";

describe("SENTRY_DATA_COLLECTION", () => {
  it("disables stack frame variable capture — the critical setting", () => {
    expect(SENTRY_DATA_COLLECTION.stackFrameVariables).toBe(false);
  });

  it("disables every other data-collection category explicitly", () => {
    expect(SENTRY_DATA_COLLECTION.cookies).toBe(false);
    expect(SENTRY_DATA_COLLECTION.httpHeaders).toEqual({ request: false, response: false });
    expect(SENTRY_DATA_COLLECTION.httpBodies).toEqual([]);
    expect(SENTRY_DATA_COLLECTION.urlQueryParams).toBe(false);
    expect(SENTRY_DATA_COLLECTION.userInfo).toBe(false);
    expect(SENTRY_DATA_COLLECTION.databaseQueryData).toBe(false);
    expect(SENTRY_DATA_COLLECTION.genAI).toEqual({ inputs: false, outputs: false });
  });
});

describe("scrubBreadcrumb", () => {
  it("drops console breadcrumbs entirely", () => {
    expect(scrubBreadcrumb({ category: "console", message: "hello" })).toBeNull();
  });

  it("passes through non-console breadcrumbs unchanged", () => {
    const breadcrumb = { category: "navigation", message: "/write" };
    expect(scrubBreadcrumb(breadcrumb)).toEqual(breadcrumb);
  });

  it("passes through a breadcrumb with no category", () => {
    const breadcrumb = { message: "something" };
    expect(scrubBreadcrumb(breadcrumb)).toEqual(breadcrumb);
  });
});

describe("scrubEvent", () => {
  it("strips request.data, cookies, and headers if present", () => {
    const event = {
      request: {
        data: "some body",
        cookies: { session: "abc" },
        headers: { authorization: "Bearer xyz" },
        url: "https://creator-ai.in/api/entries",
      },
    };
    const result = scrubEvent(event);
    expect(result?.request?.data).toBeUndefined();
    expect(result?.request?.cookies).toBeUndefined();
    expect(result?.request?.headers).toBeUndefined();
    expect(result?.request?.url).toBe("https://creator-ai.in/api/entries");
  });

  it("redacts extra fields whose key matches a sensitive pattern", () => {
    const event = {
      extra: { passphrase: "correct horse battery staple", route: "/write" },
    };
    const result = scrubEvent(event);
    expect(result?.extra?.passphrase).toBe("[redacted]");
    expect(result?.extra?.route).toBe("/write");
  });

  it("redacts sensitive keys case-insensitively and by substring", () => {
    const event = {
      extra: { recoveryPhrase: "ocean velvet prism", entryContent: "dear diary" },
    };
    const result = scrubEvent(event);
    expect(result?.extra?.recoveryPhrase).toBe("[redacted]");
    expect(result?.extra?.entryContent).toBe("[redacted]");
  });

  it("leaves an event with no request or extra untouched", () => {
    const event = { message: "TypeError: x is not a function" } as ErrorEvent;
    expect(scrubEvent(event)).toEqual(event);
  });
});
