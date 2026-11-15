// Site-specific (not part of AstroPaper): opt-in PostHog analytics flow.
//
// - PostHog is neither loaded nor contacted until the visitor accepts. Unknown,
//   rejected, malformed or unreadable consent keeps it off.
// - Accept starts PostHog once. Nothing from before the choice is buffered.
// - Reject or withdrawal stops it. A loaded SDK is opted out, its storage is
//   removed and the page reloads, so no instance, timer or script request from
//   the old page survives the choice. Events are sent as captured (no batching,
//   see posthog-loader.ts), so none are left waiting to be flushed on unload.
// - A Reject this page could not store still wins here, and the page reloads
//   only if the next load will keep PostHog off too.
//
// Everything the flow touches comes in through `env`, so scripts/*.test.mjs can
// run it against fakes. analytics.ts wires it to the real browser. The consent
// rules are in consent.ts and the loader and PostHog options in posthog-loader.ts.

import {
  clearPostHogStorage,
  CONSENT_KEY,
  readConsent,
  removeConsent,
  writeConsent,
  type ConsentState,
} from "./consent.ts";
import {
  buildInitConfig,
  loadPostHog,
  type LoaderDocument,
  type LoaderWindow,
} from "./posthog-loader.ts";

export const CONSENT_CHANGE_EVENT = "analytics-consent-change";

export interface AnalyticsWindow extends LoaderWindow {
  localStorage: Storage;
  sessionStorage: Storage;
  location: { hostname: string; reload(): void };
  addEventListener(
    type: string,
    listener: (event: { key?: string | null; persisted?: boolean }) => void
  ): void;
}

export interface AnalyticsDocument extends LoaderDocument {
  cookie: string;
  dispatchEvent(event: Event): boolean;
}

export interface AnalyticsEnv {
  window: AnalyticsWindow;
  document: AnalyticsDocument;
  /** PostHog project token. Without one PostHog never loads. */
  token?: string;
  /** Overrides the ingestion host (tests). Defaults to the managed proxy. */
  apiHost?: string;
}

export function createAnalytics(env: AnalyticsEnv) {
  const { window: win, document: doc, token } = env;
  let started = false;
  // A choice made on this page that could not be stored. It counts as a
  // refusal and outranks whatever storage holds (including an older "granted")
  // until the visitor chooses again here. It can never enable PostHog.
  let unsavedDenial = false;
  let initialised = false;

  function store(kind: "localStorage" | "sessionStorage"): Storage | null {
    try {
      return win[kind];
    } catch {
      return null;
    }
  }

  /** What the next page load will read. */
  const storedConsent = () => readConsent(store("localStorage"));

  function getConsent(): ConsentState {
    return unsavedDenial ? "denied" : storedConsent();
  }

  function clearStorage(options?: { keepOptOutFlag?: boolean }): void {
    if (!token) return;
    clearPostHogStorage(
      {
        token,
        hostname: win.location.hostname,
        local: store("localStorage"),
        session: store("sessionStorage"),
        cookies: {
          read: () => doc.cookie,
          write: cookie => {
            doc.cookie = cookie;
          },
        },
      },
      options
    );
  }

  function startPostHog(): void {
    if (started || !token) return;
    started = true;
    const loading = loadPostHog(
      win,
      doc,
      token,
      buildInitConfig(env.apiHost),
      // The script could not be downloaded (blocked, offline, proxy down).
      () => {
        started = false;
      }
    );
    // PostHog was already present (for example injected elsewhere): this module
    // did not start it, so it must not claim to have, or later stop it.
    if (!loading) started = false;
  }

  function stopPostHog(): void {
    if (!started) {
      // PostHog never ran on this page: just remove leftovers (for example from
      // a legacy "yes"). Nothing is running that could write them back.
      clearStorage();
      return;
    }
    try {
      // Order matters. The SDK re-reads its opt-out flag from storage on every
      // capture, so keep that flag until the reloaded page, where no SDK runs.
      // (Not shutdown(): that flushes queued events.)
      win.posthog?.opt_out_capturing?.();
    } catch {
      /* best effort; the reload below normally ends this instance anyway */
    }
    clearStorage({ keepOptOutFlag: true });
    // Reloading drops the SDK, its timers and any request still waiting on its
    // script. init() then runs the full cleanup, since nothing is loaded. But if
    // storage still holds an acceptance this page could neither overwrite nor
    // remove, a reload would start PostHog again: stay on this page, opted out.
    if (storedConsent() !== "granted") win.location.reload();
  }

  function announce(): void {
    doc.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
  }

  /**
   * Records the visitor's choice and applies it immediately.
   * Returns false when the choice could not be remembered (PostHog then stays off).
   */
  function setConsent(choice: "granted" | "denied"): boolean {
    const local = store("localStorage");
    const persisted = writeConsent(local, choice);
    unsavedDenial = !persisted;
    // An unstored Reject must not leave an older acceptance for the next load.
    if (!persisted && choice === "denied") removeConsent(local);

    if (persisted && choice === "granted") startPostHog();
    else stopPostHog();
    announce();
    return persisted;
  }

  // Another tab changed the choice, or this page came back from the back/forward
  // cache: make the running state match the choice (an unstored Reject from
  // this page still wins over what another tab stored).
  function reconcile(): void {
    const consent = getConsent();
    if (consent === "granted") startPostHog();
    else if (started) stopPostHog();
    announce();
  }

  /** Call once per full page load. */
  function init(): void {
    if (initialised) return;
    initialised = true;

    if (getConsent() === "granted") startPostHog();
    else clearStorage(); // leftovers from a legacy "yes" or a withdrawn choice

    win.addEventListener("storage", event => {
      if (event.key === CONSENT_KEY || event.key === null) reconcile();
    });
    win.addEventListener("pageshow", event => {
      if (event.persisted) reconcile();
    });
  }

  return { getConsent, setConsent, init, isStarted: () => started };
}
