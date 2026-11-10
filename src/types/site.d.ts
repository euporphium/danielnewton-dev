// Site-specific globals (not part of AstroPaper).
declare global {
  interface Window {
    /** Defined by PostHog.astro; called by CookieConsent.astro. */
    handleCookieConsent?: (consent: "yes" | "no") => void;
  }
}

export {};
