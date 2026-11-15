// Site-specific (not part of AstroPaper): PostHog configuration and loader.
//
// This replaces PostHog's copy-paste HTML snippet, which ends with an
// unconditional `posthog.init(...)` and so would load PostHog for every
// visitor. Nothing here runs on import: analytics-core.ts calls loadPostHog()
// only after the visitor has accepted.
//
// It uses the snippet's protocol: a queueing `window.posthog` stub (marked with
// `__SV`, holding the init call in `_i`) and an injected `array.js`, which
// replays the queue. Unlike the snippet it refuses to run twice, removes the
// stub if the script fails to load, and stubs only the methods this site calls.
// DOM-agnostic so scripts/*.test.mjs can run it against fakes.

/** PostHog managed reverse proxy on this site's own domain (fronted by Cloudflare). */
export const POSTHOG_API_HOST = "https://e.danielnewton.dev";
export const POSTHOG_UI_HOST = "https://us.posthog.com";

/**
 * PostHog configuration snapshot, as in PostHog's generated snippet for this
 * project. Among other things it captures page views on history changes, so
 * Astro's ClientRouter navigation is tracked.
 */
export const POSTHOG_DEFAULTS = "2026-05-30";

/**
 * Init options. The privacy policy describes page views, clicks,
 * browser/device details and JavaScript error reports, so nothing else may run:
 * - `advanced_disable_flags` skips the feature-flag and remote-config requests,
 *   so nothing can be switched on from the PostHog dashboard.
 * - `capture_exceptions: true` reports unhandled errors and promise rejections
 *   (not console output), whatever the dashboard setting.
 * - The rest switch off, in code, every feature that could otherwise start
 *   from a setting stored by an earlier visit. Each overrides the server-side
 *   setting (checked against posthog-js 1.450.0).
 */
export function buildInitConfig(
  apiHost: string = POSTHOG_API_HOST
): Record<string, unknown> {
  return {
    api_host: apiHost,
    ui_host: POSTHOG_UI_HOST,
    defaults: POSTHOG_DEFAULTS,
    person_profiles: "identified_only",
    persistence: "localStorage+cookie",
    advanced_disable_flags: true,
    disable_session_recording: true,
    capture_exceptions: true,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    capture_performance: false, // web vitals
    disable_surveys: true,
    disable_product_tours: true,
    // Send each event as it is captured instead of in 3 s batches. A pending
    // batch is flushed when the page unloads, which would deliver events after
    // a visitor withdraws; the SDK's queue is not reachable from outside.
    request_batching: false,
  };
}

/**
 * Where `array.js` is loaded from. PostHog's own hosts use a separate assets
 * host; any other host (the managed proxy) serves `/static/array.js` itself.
 */
export function scriptUrl(apiHost: string): string {
  return (
    apiHost
      .replace(/\/+$/, "")
      .replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js"
  );
}

/**
 * Methods the stub queues until `array.js` has loaded. PostHog's snippet stubs
 * its whole API; the only call this site makes in that window is a Reject
 * between Accept and the script finishing (analytics-core.ts, stopPostHog).
 */
export const STUB_METHODS = ["opt_out_capturing"];

export interface PostHogLike {
  __SV?: number;
  __loaded?: boolean;
  opt_out_capturing?(): void;
  [key: string]: unknown;
}

interface ScriptLike {
  crossOrigin: string | null;
  async: boolean;
  src: string;
  onerror: (() => void) | null;
  remove(): void;
}

export interface LoaderDocument {
  createElement(tag: "script"): ScriptLike;
  head: { appendChild(node: unknown): unknown };
}

export interface LoaderWindow {
  posthog?: PostHogLike;
}

/**
 * Defines the stub with one queued `init` call and starts loading `array.js`.
 * Returns false (doing nothing) if PostHog is already present or loading, so
 * it can never initialise twice. If the script fails to load, the stub is
 * removed, `onError` runs, and a later call may try again.
 */
export function loadPostHog(
  win: LoaderWindow,
  doc: LoaderDocument,
  token: string,
  config: Record<string, unknown>,
  onError?: () => void
): boolean {
  if (win.posthog && (win.posthog.__SV || win.posthog.__loaded)) return false;

  const queue: unknown[] = [];
  const stub = Object.assign(queue, {
    __SV: 1,
    _i: [[token, config]],
  }) as unknown as PostHogLike;
  for (const method of STUB_METHODS) {
    stub[method] = (...args: unknown[]) => queue.push([method, ...args]);
  }
  win.posthog = stub;

  const script = doc.createElement("script");
  script.crossOrigin = "anonymous";
  script.async = true;
  script.src = scriptUrl(String(config.api_host ?? POSTHOG_API_HOST));
  script.onerror = () => {
    script.remove();
    if (win.posthog === stub) win.posthog = undefined;
    onError?.();
  };
  doc.head.appendChild(script);
  return true;
}
