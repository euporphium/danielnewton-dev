// Fakes shared by scripts/*.test.mjs. No network, no browser, no real PostHog.

export function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get length() {
      return data.size;
    },
    key: i => [...data.keys()][i] ?? null,
    getItem: k => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: k => void data.delete(k),
  };
}

const blocked = () => {
  throw new DOMException("blocked", "SecurityError");
};

/** A fake document that records injected scripts and holds a cookie jar. */
export function fakeDocument() {
  const jar = new Map();
  const scripts = [];
  const events = [];
  return {
    scripts,
    events,
    jar,
    get cookie() {
      return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    set cookie(value) {
      const [pair, ...attrs] = value.split(";").map(s => s.trim());
      const [name, val] = pair.split("=");
      if (attrs.some(a => /^Max-Age=0$/i.test(a))) jar.delete(decodeURIComponent(name));
      else jar.set(decodeURIComponent(name), val);
    },
    createElement: () => {
      const script = {
        crossOrigin: null,
        async: false,
        src: "",
        onerror: null,
        remove: () => {
          const i = scripts.indexOf(script);
          if (i >= 0) scripts.splice(i, 1);
        },
      };
      return script;
    },
    head: { appendChild: node => scripts.push(node) },
    dispatchEvent: event => {
      events.push(event.type);
      return true;
    },
  };
}

/**
 * A fake browser environment. `loadSdk()` plays the part of array.js finishing
 * its download: it replaces the stub with a fake loaded SDK that writes its
 * persistence entries and records the calls made on it.
 */
/**
 * Storage whose writes and/or removals of `key` fail (quota, blocked writes)
 * while it can still be read. Other keys behave normally.
 */
export function stuckStorage(initial, key, { failRemove = false } = {}) {
  const store = memoryStorage(initial);
  const { setItem, removeItem } = store;
  const fail = () => {
    throw new DOMException("full", "QuotaExceededError");
  };
  store.setItem = (k, v) => (k === key ? fail() : setItem(k, v));
  store.removeItem = k => (k === key && failRemove ? fail() : removeItem(k));
  return store;
}

export function fakeEnv({
  token = "phc_TESTTOKEN",
  local = memoryStorage(),
  session = memoryStorage(),
  storageBlocked = false,
  apiHost,
} = {}) {
  const doc = fakeDocument();
  const listeners = {};
  const calls = [];
  let reloads = 0;

  const win = {
    posthog: undefined,
    sessionStorage: session,
    location: {
      hostname: "www.example.test",
      reload: () => {
        calls.push("reload");
        reloads++;
        // What is still in place at the moment the page reloads.
        env.atReload = {
          local: [...local.data.keys()],
          session: [...session.data.keys()],
          cookies: [...doc.jar.keys()],
        };
      },
    },
    addEventListener: (type, fn) => (listeners[type] ??= []).push(fn),
  };
  Object.defineProperty(win, "localStorage", {
    get: () => {
      if (storageBlocked) blocked();
      return local;
    },
  });

  const env = {
    window: win,
    document: doc,
    token,
    apiHost,
    local,
    session,
    calls,
    listeners,
    /** Snapshot taken when reload() is called. */
    atReload: /** @type {any} */ (undefined),
    get reloads() {
      return reloads;
    },
    emit: (type, event = {}) => (listeners[type] ?? []).forEach(fn => fn(event)),
    /** Simulates array.js loading and initialising from the queued init call. */
    loadSdk() {
      const [initToken, config] = win.posthog._i[0];
      const sdk = {
        __loaded: true,
        config,
        initToken,
        opt_out_capturing() {
          calls.push("opt_out_capturing");
          // Like the real SDK: stores its own opt-out flag.
          local.setItem(`__ph_opt_in_out_${token}`, "0");
        },
        shutdown() {
          calls.push("shutdown");
        },
      };
      win.posthog = sdk;
      local.setItem(`ph_${token}_posthog`, "{}");
      local.setItem(`ph_${token}_posthog__flags`, "{}");
      session.setItem(`ph_${token}_window_id`, "w");
      doc.cookie = `ph_${token}_posthog=abc`;
      return sdk;
    },
  };
  return env;
}
