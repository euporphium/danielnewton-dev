// Tests for the opt-in PostHog flow (src/scripts/analytics-core.ts) and the
// loader and proxy configuration (src/scripts/posthog-loader.ts).
// Run with `pnpm test`. Everything is faked: no browser, no network, and no
// request can reach PostHog. Real-browser behaviour is checked by hand against
// a local stub server; see the PR notes.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAnalytics, CONSENT_CHANGE_EVENT } from "../src/scripts/analytics-core.ts";
import { CONSENT_KEY, LEGACY_CONSENT_KEY } from "../src/scripts/consent.ts";
import {
  POSTHOG_API_HOST,
  POSTHOG_DEFAULTS,
  POSTHOG_UI_HOST,
  STUB_METHODS,
  buildInitConfig,
  loadPostHog,
  scriptUrl,
} from "../src/scripts/posthog-loader.ts";
import { fakeDocument, fakeEnv, memoryStorage, stuckStorage } from "./test-helpers.mjs";

const TOKEN = "phc_TESTTOKEN";
const setup = options => {
  const env = fakeEnv(options);
  return { env, analytics: createAnalytics(env) };
};

describe("proxy host and init config", () => {
  it("sends traffic to the site's managed-proxy host, not PostHog directly", () => {
    assert.equal(POSTHOG_API_HOST, "https://e.danielnewton.dev");
    assert.equal(POSTHOG_UI_HOST, "https://us.posthog.com");
    assert.equal(POSTHOG_DEFAULTS, "2026-05-30");
    const config = buildInitConfig();
    assert.equal(config.api_host, "https://e.danielnewton.dev");
    assert.equal(config.ui_host, "https://us.posthog.com");
    assert.equal(config.defaults, "2026-05-30");
    assert.equal(config.person_profiles, "identified_only");
    assert.equal(config.persistence, "localStorage+cookie");
  });

  // The privacy policy describes exactly this config. Change both together.
  it("enables only what the privacy policy describes", () => {
    assert.deepEqual(buildInitConfig(), {
      api_host: "https://e.danielnewton.dev",
      ui_host: "https://us.posthog.com",
      defaults: "2026-05-30",
      person_profiles: "identified_only",
      persistence: "localStorage+cookie",
      // No /flags or remote-config request, so the dashboard can't enable anything.
      advanced_disable_flags: true,
      disable_session_recording: true,
      // Unhandled errors and promise rejections; the policy and banner say so.
      capture_exceptions: true,
      capture_heatmaps: false,
      capture_dead_clicks: false,
      capture_performance: false,
      disable_surveys: true,
      disable_product_tours: true,
      // Sent as captured, so nothing waits in a batch to be flushed after withdrawal.
      request_batching: false,
    });
  });

  it("takes only the ingestion host from an override", () => {
    const config = buildInitConfig("http://localhost:8099");
    assert.equal(config.api_host, "http://localhost:8099");
    assert.equal(config.defaults, "2026-05-30");
    assert.equal(config.ui_host, "https://us.posthog.com");
  });

  it("loads array.js from the proxy host", () => {
    assert.equal(scriptUrl("https://e.danielnewton.dev"), "https://e.danielnewton.dev/static/array.js");
    assert.equal(scriptUrl("https://e.danielnewton.dev/"), "https://e.danielnewton.dev/static/array.js");
    assert.equal(scriptUrl("http://localhost:8099"), "http://localhost:8099/static/array.js");
  });

  it("still maps PostHog's own ingestion hosts to their assets hosts", () => {
    assert.equal(scriptUrl("https://us.i.posthog.com"), "https://us-assets.i.posthog.com/static/array.js");
    assert.equal(scriptUrl("https://eu.i.posthog.com"), "https://eu-assets.i.posthog.com/static/array.js");
  });
});

describe("loader", () => {
  it("touches no browser global on import", async () => {
    const names = ["window", "document", "posthog", "localStorage"];
    const touched = [];
    for (const name of names) {
      Object.defineProperty(globalThis, name, {
        configurable: true,
        get: () => void touched.push(name),
        set: () => void touched.push(name),
      });
    }
    try {
      // The query string forces a fresh evaluation of each module.
      await import("../src/scripts/posthog-loader.ts?import-test");
      await import("../src/scripts/analytics-core.ts?import-test");
    } finally {
      for (const name of names) delete globalThis[name];
    }
    assert.deepEqual(touched, []);
  });

  it("injects one script and queues one init call", () => {
    const win = {};
    const doc = fakeDocument();
    const config = buildInitConfig();
    assert.equal(loadPostHog(win, doc, TOKEN, config), true);

    assert.equal(doc.scripts.length, 1);
    const [script] = doc.scripts;
    assert.equal(script.src, "https://e.danielnewton.dev/static/array.js");
    assert.equal(script.crossOrigin, "anonymous");
    assert.equal(script.async, true);
    assert.equal(win.posthog.__SV, 1);
    assert.deepEqual(win.posthog._i, [[TOKEN, config]]);
  });

  it("never initialises twice (stub present or SDK loaded)", () => {
    const win = {};
    const doc = fakeDocument();
    assert.equal(loadPostHog(win, doc, TOKEN, buildInitConfig()), true);
    assert.equal(loadPostHog(win, doc, TOKEN, buildInitConfig()), false);
    assert.equal(doc.scripts.length, 1);
    assert.equal(win.posthog._i.length, 1);

    const loaded = { posthog: { __loaded: true } };
    const doc2 = fakeDocument();
    assert.equal(loadPostHog(loaded, doc2, TOKEN, buildInitConfig()), false);
    assert.equal(doc2.scripts.length, 0);

    const foreign = { posthog: { __SV: 1 } };
    assert.equal(loadPostHog(foreign, doc2, TOKEN, buildInitConfig()), false);
    assert.equal(doc2.scripts.length, 0);
  });

  it("removes the stub on a script load error so a later call can retry", () => {
    const win = {};
    const doc = fakeDocument();
    let errors = 0;
    loadPostHog(win, doc, TOKEN, buildInitConfig(), () => errors++);

    doc.scripts[0].onerror();
    assert.equal(errors, 1);
    assert.equal(win.posthog, undefined);
    assert.equal(doc.scripts.length, 0);

    assert.equal(loadPostHog(win, doc, TOKEN, buildInitConfig()), true);
    assert.equal(doc.scripts.length, 1);
  });

  it("queues the one call the site makes before the SDK loads", () => {
    assert.deepEqual(STUB_METHODS, ["opt_out_capturing"]);
    const win = {};
    loadPostHog(win, fakeDocument(), TOKEN, buildInitConfig());
    win.posthog.opt_out_capturing();
    assert.deepEqual([...win.posthog], [["opt_out_capturing"]]);
  });
});

describe("consent gate: nothing loads without an explicit Accept", () => {
  const cases = {
    "no stored choice": {},
    "rejected": { [CONSENT_KEY]: "denied" },
    "malformed value": { [CONSENT_KEY]: "true" },
    "legacy 'yes' from the old banner": { [LEGACY_CONSENT_KEY]: "yes" },
    "legacy 'no'": { [LEGACY_CONSENT_KEY]: "no" },
  };
  for (const [name, stored] of Object.entries(cases)) {
    it(`page load with ${name}`, () => {
      const { env, analytics } = setup({ local: memoryStorage(stored) });
      analytics.init();
      assert.equal(env.document.scripts.length, 0);
      assert.equal(env.window.posthog, undefined);
      assert.equal(env.reloads, 0);
    });
  }

  it("page load with unreadable storage", () => {
    const { env, analytics } = setup({ storageBlocked: true });
    analytics.init();
    assert.equal(analytics.getConsent(), "unset");
    assert.equal(env.document.scripts.length, 0);
    assert.equal(env.window.posthog, undefined);
  });

  it("page load with no project token", () => {
    const { env, analytics } = setup({ token: "", local: memoryStorage({ [CONSENT_KEY]: "granted" }) });
    analytics.init();
    assert.equal(env.document.scripts.length, 0);
    analytics.setConsent("granted");
    assert.equal(env.document.scripts.length, 0);
  });

  it("removes leftover PostHog entries from earlier acceptance, keeping unrelated ones", () => {
    const local = memoryStorage({
      [LEGACY_CONSENT_KEY]: "yes",
      theme: "dark",
      [`ph_${TOKEN}_posthog`]: "{}",
      [`ph_${TOKEN}_posthog__flags`]: "{}",
      [`__ph_opt_in_out_${TOKEN}`]: "0",
    });
    const { env, analytics } = setup({ local });
    env.document.cookie = `ph_${TOKEN}_posthog=old`;
    analytics.init();
    assert.deepEqual([...local.data.keys()].sort(), [LEGACY_CONSENT_KEY, "theme"]);
    assert.equal(env.document.jar.size, 0);
    assert.equal(env.document.scripts.length, 0);
  });
});

describe("Accept", () => {
  it("loads PostHog on the next load when previously accepted", () => {
    const { env, analytics } = setup({ local: memoryStorage({ [CONSENT_KEY]: "granted" }) });
    analytics.init();
    assert.equal(env.document.scripts.length, 1);
    assert.equal(env.document.scripts[0].src, "https://e.danielnewton.dev/static/array.js");
    assert.equal(env.window.posthog._i[0][0], TOKEN);
  });

  it("starts PostHog exactly once, even on repeated clicks", () => {
    const { env, analytics } = setup();
    analytics.init();
    assert.equal(analytics.setConsent("granted"), true);
    analytics.setConsent("granted");
    assert.equal(env.document.scripts.length, 1);
    assert.equal(env.window.posthog._i.length, 1);
    assert.deepEqual(env.window.posthog._i[0][1], buildInitConfig());
    assert.equal(analytics.getConsent(), "granted");
    assert.ok(env.document.events.includes(CONSENT_CHANGE_EVENT));
  });

  it("does not buffer anything captured before the choice", () => {
    const { env, analytics } = setup();
    analytics.init();
    assert.equal(env.window.posthog, undefined);
    analytics.setConsent("granted");
    // Only the single init call is queued; nothing was recorded earlier.
    assert.equal(env.window.posthog._i.length, 1);
    assert.equal(env.window.posthog.length, 0);
  });

  it("uses the ingestion host override when given (local tests)", () => {
    const { env, analytics } = setup({ apiHost: "http://localhost:8099" });
    analytics.init();
    analytics.setConsent("granted");
    assert.equal(env.document.scripts[0].src, "http://localhost:8099/static/array.js");
  });

  it("lets a later Accept retry after the script failed to load", () => {
    const { env, analytics } = setup();
    analytics.init();
    analytics.setConsent("granted");
    env.document.scripts[0].onerror();
    assert.equal(analytics.isStarted(), false);
    assert.equal(env.window.posthog, undefined);

    analytics.setConsent("granted");
    assert.equal(env.document.scripts.length, 1);
  });

  it("does not claim a PostHog it did not start", () => {
    const { env, analytics } = setup();
    env.window.posthog = { __loaded: true };
    analytics.init();
    analytics.setConsent("granted");
    assert.equal(env.document.scripts.length, 0);
    assert.equal(analytics.isStarted(), false);
  });
});

describe("Reject and withdrawal", () => {
  it("Reject before anything loaded leaves PostHog off with no reload", () => {
    const { env, analytics } = setup();
    analytics.init();
    assert.equal(analytics.setConsent("denied"), true);
    assert.equal(analytics.getConsent(), "denied");
    assert.equal(env.document.scripts.length, 0);
    assert.equal(env.reloads, 0);
  });

  it("withdrawal opts out, clears storage and reloads, in that order", () => {
    const { env, analytics } = setup({ local: memoryStorage({ [CONSENT_KEY]: "granted", theme: "dark" }) });
    analytics.init();
    env.loadSdk();

    assert.equal(analytics.setConsent("denied"), true);

    assert.deepEqual(env.calls, ["opt_out_capturing", "reload"]);
    assert.ok(!env.calls.includes("shutdown"), "shutdown() would flush queued events");
    // At reload time: PostHog identity is gone, its opt-out flag is still in
    // place (a live SDK re-reads it on every capture), unrelated keys remain.
    assert.deepEqual(env.atReload.local.sort(), [CONSENT_KEY, "theme", `__ph_opt_in_out_${TOKEN}`].sort());
    assert.deepEqual(env.atReload.session, []);
    assert.deepEqual(env.atReload.cookies, []);
    assert.equal(env.local.getItem(CONSENT_KEY), "denied");
  });

  it("the page after a withdrawal loads nothing and removes the opt-out flag", () => {
    const local = memoryStorage({ [CONSENT_KEY]: "denied", theme: "dark", [`__ph_opt_in_out_${TOKEN}`]: "0" });
    const { env, analytics } = setup({ local });
    analytics.init();
    assert.equal(env.document.scripts.length, 0);
    assert.deepEqual([...local.data.keys()].sort(), [CONSENT_KEY, "theme"]);
  });

  it("Accept then Reject before the SDK finishes loading still stops everything", () => {
    const { env, analytics } = setup();
    analytics.init();
    analytics.setConsent("granted");
    analytics.setConsent("denied"); // SDK script has not loaded: only the stub exists
    assert.equal(env.document.scripts.length, 1);
    assert.deepEqual(env.calls, ["reload"]);
    assert.equal(env.local.getItem(CONSENT_KEY), "denied");
    assert.equal(env.window.posthog[0][0], "opt_out_capturing"); // queued on the stub
  });

  it("an SDK that fails to load needs no reload on withdrawal", () => {
    const { env, analytics } = setup();
    analytics.init();
    analytics.setConsent("granted");
    env.document.scripts[0].onerror();
    analytics.setConsent("denied");
    assert.equal(env.reloads, 0);
  });
});

describe("Reject when storage still holds an earlier acceptance", () => {
  const acceptedThenRunning = options => {
    const local = stuckStorage({ [CONSENT_KEY]: "granted" }, CONSENT_KEY, options);
    const { env, analytics } = setup({ local });
    analytics.init();
    env.loadSdk();
    return { env, analytics, local };
  };

  it("write fails: the Reject wins, the acceptance is removed, and the reload loads nothing", () => {
    const { env, analytics, local } = acceptedThenRunning();
    assert.equal(analytics.setConsent("denied"), false);
    assert.equal(analytics.getConsent(), "denied");
    assert.deepEqual(env.calls, ["opt_out_capturing", "reload"]);
    assert.equal(local.getItem(CONSENT_KEY), null);

    // The reloaded page, on the same storage.
    const next = setup({ local });
    next.analytics.init();
    assert.equal(next.env.document.scripts.length, 0);
    assert.equal(next.analytics.getConsent(), "unset"); // asked again
  });

  it("write and removal fail: stays on the page opted out instead of reloading into PostHog", () => {
    const { env, analytics, local } = acceptedThenRunning({ failRemove: true });
    assert.equal(analytics.setConsent("denied"), false);
    assert.equal(local.getItem(CONSENT_KEY), "granted");
    assert.equal(analytics.getConsent(), "denied");
    assert.deepEqual(env.calls, ["opt_out_capturing"]);
    assert.equal(env.reloads, 0);
    assert.equal(local.getItem(`__ph_opt_in_out_${TOKEN}`), "0"); // SDK's own opt-out kept

    // Other tabs and the back/forward cache can't bring it back either.
    env.emit("storage", { key: CONSENT_KEY });
    env.emit("storage", { key: null });
    env.emit("pageshow", { persisted: true });
    assert.equal(analytics.getConsent(), "denied");
    assert.equal(env.reloads, 0);
    assert.equal(env.document.scripts.length, 1);
    assert.ok(env.calls.every(call => call === "opt_out_capturing"));
  });

  it("another tab whose Reject could only remove the acceptance still stops this tab", () => {
    const { env, analytics } = setup({ local: memoryStorage({ [CONSENT_KEY]: "granted" }) });
    analytics.init();
    env.loadSdk();
    env.local.removeItem(CONSENT_KEY);
    env.emit("storage", { key: CONSENT_KEY });
    assert.deepEqual(env.calls, ["opt_out_capturing", "reload"]);
  });
});

describe("storage unavailable", () => {
  it("never enables PostHog and reports that the choice was not remembered", () => {
    const { env, analytics } = setup({ storageBlocked: true });
    analytics.init();
    assert.equal(analytics.setConsent("granted"), false);
    assert.equal(env.document.scripts.length, 0);
    assert.equal(env.window.posthog, undefined);
    // The banner can close for this page: the choice acts as a rejection.
    assert.equal(analytics.getConsent(), "denied");
  });
});

describe("other tabs and the back/forward cache", () => {
  it("another tab withdrawing stops this tab's running PostHog", () => {
    const { env, analytics } = setup({ local: memoryStorage({ [CONSENT_KEY]: "granted" }) });
    analytics.init();
    env.loadSdk();
    env.local.setItem(CONSENT_KEY, "denied");
    env.emit("storage", { key: CONSENT_KEY });
    assert.deepEqual(env.calls, ["opt_out_capturing", "reload"]);
  });

  it("another tab accepting starts PostHog here", () => {
    const { env, analytics } = setup();
    analytics.init();
    env.local.setItem(CONSENT_KEY, "granted");
    env.emit("storage", { key: CONSENT_KEY });
    assert.equal(env.document.scripts.length, 1);
  });

  it("ignores unrelated storage changes", () => {
    const { env, analytics } = setup();
    analytics.init();
    env.local.setItem(CONSENT_KEY, "granted");
    env.emit("storage", { key: "theme" });
    assert.equal(env.document.scripts.length, 0);
  });

  it("re-checks consent when restored from the back/forward cache", () => {
    const { env, analytics } = setup({ local: memoryStorage({ [CONSENT_KEY]: "granted" }) });
    analytics.init();
    env.loadSdk();
    env.local.setItem(CONSENT_KEY, "denied");
    env.emit("pageshow", { persisted: false });
    assert.equal(env.reloads, 0);
    env.emit("pageshow", { persisted: true });
    assert.equal(env.reloads, 1);
  });

  it("registers its listeners once per page load", () => {
    const { env, analytics } = setup();
    analytics.init();
    analytics.init();
    assert.equal(env.listeners.storage.length, 1);
    assert.equal(env.listeners.pageshow.length, 1);
  });
});
