// Unit tests for the analytics consent rules (src/scripts/consent.ts).
// Run with `pnpm test`. Node strips the TypeScript types on import.
//
// What this covers: stored-choice parsing (unknown, accepted, rejected,
// malformed, legacy, unreadable storage), persistence failures, and cleanup of
// PostHog's storage. Browser behaviour (no request before consent, SDK start
// and stop, ClientRouter, reload) is checked by hand; see the PR notes.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONSENT_KEY,
  LEGACY_CONSENT_KEY,
  clearPostHogStorage,
  cookieDomains,
  isPostHogStorageName,
  readConsent,
  writeConsent,
} from "../src/scripts/consent.ts";
import { memoryStorage } from "./test-helpers.mjs";

const throwing = () => {
  throw new DOMException("blocked", "SecurityError");
};
const blockedStorage = {
  getItem: throwing,
  setItem: throwing,
  removeItem: throwing,
};

describe("readConsent", () => {
  it("is unset when nothing is stored", () => {
    assert.equal(readConsent(memoryStorage()), "unset");
  });

  it("returns the stored choice", () => {
    assert.equal(readConsent(memoryStorage({ [CONSENT_KEY]: "granted" })), "granted");
    assert.equal(readConsent(memoryStorage({ [CONSENT_KEY]: "denied" })), "denied");
  });

  it("treats malformed values as unset, never as granted", () => {
    for (const value of ["yes", "true", "1", "GRANTED", "", "granted ", "{}"]) {
      assert.equal(readConsent(memoryStorage({ [CONSENT_KEY]: value })), "unset", value);
    }
  });

  it("is unset when storage is missing or throws", () => {
    assert.equal(readConsent(null), "unset");
    assert.equal(readConsent(blockedStorage), "unset");
  });

  it("does not carry over a legacy 'yes'", () => {
    const store = memoryStorage({ [LEGACY_CONSENT_KEY]: "yes" });
    assert.equal(readConsent(store), "unset");
    assert.equal(store.getItem(CONSENT_KEY), null);
  });

  it("honours a legacy 'no' and migrates it", () => {
    const store = memoryStorage({ [LEGACY_CONSENT_KEY]: "no" });
    assert.equal(readConsent(store), "denied");
    assert.equal(store.getItem(CONSENT_KEY), "denied");
    assert.equal(store.getItem(LEGACY_CONSENT_KEY), null);
  });

  it("honours a legacy 'no' even if the migration write fails", () => {
    const store = memoryStorage({ [LEGACY_CONSENT_KEY]: "no" });
    store.setItem = throwing;
    assert.equal(readConsent(store), "denied");
  });

  it("prefers the new key over the legacy key", () => {
    const store = memoryStorage({
      [CONSENT_KEY]: "denied",
      [LEGACY_CONSENT_KEY]: "yes",
    });
    assert.equal(readConsent(store), "denied");
  });
});

describe("writeConsent", () => {
  it("stores the choice, reads it back and removes the legacy key", () => {
    const store = memoryStorage({ [LEGACY_CONSENT_KEY]: "yes" });
    assert.equal(writeConsent(store, "granted"), true);
    assert.equal(readConsent(store), "granted");
    assert.equal(store.getItem(LEGACY_CONSENT_KEY), null);
  });

  it("supports withdrawing a previous acceptance", () => {
    const store = memoryStorage();
    writeConsent(store, "granted");
    assert.equal(writeConsent(store, "denied"), true);
    assert.equal(readConsent(store), "denied");
  });

  it("reports failure when storage throws or is missing", () => {
    assert.equal(writeConsent(blockedStorage, "granted"), false);
    assert.equal(writeConsent(null, "granted"), false);
  });

  it("reports failure when the write does not stick", () => {
    const store = memoryStorage();
    store.setItem = () => {}; // silently dropped
    assert.equal(writeConsent(store, "granted"), false);
  });

  it("reports failure when a failed write leaves a different choice in place", () => {
    const store = memoryStorage({ [CONSENT_KEY]: "granted" });
    store.setItem = throwing;
    assert.equal(writeConsent(store, "denied"), false);
  });

  it("counts a failed write as stored when the same choice is already there", () => {
    const store = memoryStorage({ [CONSENT_KEY]: "denied" });
    store.setItem = throwing;
    assert.equal(writeConsent(store, "denied"), true);
  });

  it("does not touch unrelated keys", () => {
    const store = memoryStorage({ theme: "dark" });
    writeConsent(store, "denied");
    assert.equal(store.getItem("theme"), "dark");
  });
});

describe("PostHog storage cleanup", () => {
  const token = "phc_TESTTOKEN";

  it("recognises only this project's PostHog entries", () => {
    assert.equal(isPostHogStorageName(`ph_${token}_posthog`, token), true);
    assert.equal(isPostHogStorageName(`ph_${token}_window_id`, token), true);
    assert.equal(isPostHogStorageName(`__ph_opt_in_out_${token}`, token), true);
    assert.equal(isPostHogStorageName("ph_phc_OTHER_posthog", token), false);
    assert.equal(isPostHogStorageName(CONSENT_KEY, token), false);
    assert.equal(isPostHogStorageName("theme", token), false);
    assert.equal(isPostHogStorageName("ph_anything", ""), false);
  });

  it("builds cookie domains from the hostname", () => {
    assert.deepEqual(cookieDomains("www.danielnewton.dev"), [
      undefined,
      "www.danielnewton.dev",
      ".www.danielnewton.dev",
      ".danielnewton.dev",
    ]);
    assert.deepEqual(cookieDomains("localhost"), [undefined, "localhost"]);
    assert.deepEqual(cookieDomains("127.0.0.1"), [undefined, "127.0.0.1"]);
  });

  it("removes PostHog entries and keeps everything else", () => {
    const local = memoryStorage({
      [`ph_${token}_posthog`]: "{}",
      [`__ph_opt_in_out_${token}`]: "0",
      [CONSENT_KEY]: "denied",
      theme: "dark",
      ph_phc_OTHER_posthog: "{}",
    });
    const session = memoryStorage({
      [`ph_${token}_window_id`]: "x",
      unrelated: "1",
    });
    const jar = new Map([
      [`ph_${token}_posthog`, "abc"],
      ["session", "keep"],
    ]);
    const writes = [];

    clearPostHogStorage({
      token,
      hostname: "www.danielnewton.dev",
      local,
      session,
      cookies: {
        read: () => [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
        write: cookie => writes.push(cookie),
      },
    });

    assert.deepEqual([...local.data.keys()].sort(), [
      CONSENT_KEY,
      "ph_phc_OTHER_posthog",
      "theme",
    ]);
    assert.deepEqual([...session.data.keys()], ["unrelated"]);

    // Only the PostHog cookie is expired, on every candidate domain.
    assert.ok(writes.length > 0);
    for (const cookie of writes) {
      assert.match(cookie, new RegExp(`^ph_${token}_posthog=; Max-Age=0; Path=/`));
    }
    assert.ok(writes.some(c => c.includes("Domain=.danielnewton.dev")));
    assert.ok(writes.some(c => !c.includes("Domain=")));
  });

  it("can keep the SDK's opt-out flag so a running SDK stays opted out", () => {
    const local = memoryStorage({
      [`ph_${token}_posthog`]: "{}",
      [`__ph_opt_in_out_${token}`]: "0",
    });
    const jar = new Map([
      [`ph_${token}_posthog`, "abc"],
      [`__ph_opt_in_out_${token}`, "0"],
    ]);
    const writes = [];
    const targets = {
      token,
      hostname: "localhost",
      local,
      session: null,
      cookies: {
        read: () => [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
        write: cookie => writes.push(cookie),
      },
    };

    clearPostHogStorage(targets, { keepOptOutFlag: true });
    assert.deepEqual([...local.data.keys()], [`__ph_opt_in_out_${token}`]);
    assert.ok(writes.every(c => c.startsWith(`ph_${token}_posthog=`)));

    clearPostHogStorage(targets);
    assert.equal(local.data.size, 0);
    assert.ok(writes.some(c => c.startsWith(`__ph_opt_in_out_${token}=`)));
  });

  it("does nothing without a token and survives unavailable storage", () => {
    const local = memoryStorage({ ph_x_posthog: "{}" });
    clearPostHogStorage({ token: "", hostname: "h", local, session: null, cookies: null });
    assert.equal(local.data.size, 1);

    assert.doesNotThrow(() =>
      clearPostHogStorage({
        token,
        hostname: "h",
        local: {
          get length() {
            throw new DOMException("blocked", "SecurityError");
          },
        },
        session: null,
        cookies: {
          read: throwing,
          write: throwing,
        },
      })
    );
  });
});
