// Site-specific (not part of AstroPaper): analytics consent state.
//
// Pure logic with no DOM or SDK access so it can be unit tested under Node
// (see scripts/consent.test.mjs). PostHog is opt-in: only an explicit stored
// "granted" enables it. Missing, malformed, unreadable and legacy values never do.

export const CONSENT_KEY = "analytics_consent";

/**
 * Key written by the first banner, which only said the site "uses data
 * collection". A stored "yes" there was not an informed choice about PostHog,
 * so it is ignored and the visitor is asked again. A stored "no" is honoured
 * (it is a refusal under any wording) and migrated to CONSENT_KEY.
 */
export const LEGACY_CONSENT_KEY = "cookie_consent";

export type ConsentState = "granted" | "denied" | "unset";

export type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Returns the stored choice. Any failure or unexpected value is "unset". */
export function readConsent(store: KeyValueStore | null): ConsentState {
  if (!store) return "unset";
  try {
    const value = store.getItem(CONSENT_KEY);
    if (value === "granted" || value === "denied") return value;
    if (value !== null) return "unset"; // malformed

    if (store.getItem(LEGACY_CONSENT_KEY) === "no") {
      // Migrate best effort; the refusal applies even if the write fails.
      try {
        store.setItem(CONSENT_KEY, "denied");
        store.removeItem(LEGACY_CONSENT_KEY);
      } catch {
        /* ignore */
      }
      return "denied";
    }
    return "unset";
  } catch {
    return "unset";
  }
}

/**
 * Stores the choice and reads it back. Returns true only if the next page load
 * will read `state`, so callers never rely on a choice that would not survive
 * (storage blocked or full, or an older value left in place).
 */
export function writeConsent(
  store: KeyValueStore | null,
  state: "granted" | "denied"
): boolean {
  if (!store) return false;
  try {
    store.setItem(CONSENT_KEY, state);
  } catch {
    /* the read-back below decides */
  }
  try {
    if (store.getItem(CONSENT_KEY) !== state) return false;
  } catch {
    return false;
  }
  try {
    store.removeItem(LEGACY_CONSENT_KEY);
  } catch {
    /* ignore */
  }
  return true;
}

/** Removes the stored choice, best effort. */
export function removeConsent(store: KeyValueStore | null): void {
  try {
    store?.removeItem(CONSENT_KEY);
  } catch {
    /* ignore */
  }
}

/** Storage names PostHog uses for one project token (cookie and web storage). */
export function isPostHogStorageName(name: string, token: string): boolean {
  if (!token) return false;
  return (
    name.startsWith(`ph_${token}`) ||
    name.startsWith(`__ph_opt_in_out_${token}`)
  );
}

/** Cookie `domain` values to try when expiring a cookie set for `hostname`. */
export function cookieDomains(hostname: string): (string | undefined)[] {
  const domains: (string | undefined)[] = [undefined, hostname];
  const parts = hostname.split(".");
  if (parts.length > 1 && !/^\d+(\.\d+){3}$/.test(hostname)) {
    for (let i = 0; i < parts.length - 1; i++) {
      domains.push(`.${parts.slice(i).join(".")}`);
    }
  }
  return domains;
}

export interface PostHogCleanupTargets {
  token: string;
  hostname: string;
  local: Storage | null;
  session: Storage | null;
  /** document.cookie getter and setter. */
  cookies: { read(): string; write(cookie: string): void } | null;
}

/**
 * Removes PostHog's own entries for this project (identity, session, opt-in
 * flags) from localStorage, sessionStorage and cookies. Nothing else is
 * touched: not the consent choice, theme preference or other sites' keys.
 *
 * `keepOptOutFlag` leaves the SDK's own opt-out flag in place. A running SDK
 * re-reads that flag from storage on every capture, so deleting it before the
 * page unloads would let the SDK resume capturing (for example `$pageleave`).
 * The next page load, where no SDK runs, removes it with a normal cleanup.
 */
export function clearPostHogStorage(
  targets: PostHogCleanupTargets,
  options: { keepOptOutFlag?: boolean } = {}
): void {
  const { token, hostname, local, session, cookies } = targets;
  if (!token) return;
  const shouldRemove = (name: string) =>
    isPostHogStorageName(name, token) &&
    !(options.keepOptOutFlag && name.startsWith("__ph_opt_in_out_"));

  for (const store of [local, session]) {
    if (!store) continue;
    try {
      const names: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const name = store.key(i);
        if (name && shouldRemove(name)) names.push(name);
      }
      for (const name of names) store.removeItem(name);
    } catch {
      /* storage unavailable */
    }
  }

  if (!cookies) return;
  try {
    const names = cookies
      .read()
      .split(";")
      .map(part => decodeURIComponent(part.split("=")[0].trim()))
      .filter(shouldRemove);
    for (const name of names) {
      for (const domain of cookieDomains(hostname)) {
        cookies.write(
          `${encodeURIComponent(name)}=; Max-Age=0; Path=/; SameSite=Lax` +
            (domain ? `; Domain=${domain}` : "")
        );
      }
    }
  } catch {
    /* cookies unavailable */
  }
}
