// Site-specific (not part of AstroPaper): browser wiring for opt-in PostHog.
//
// Runs once per full page load (ClientRouter swaps do not re-run it). All
// behaviour lives in analytics-core.ts; see there for the consent rules.
// `PUBLIC_PH_PROJECT_API_KEY` supplies the project token (never hardcoded).
// `PUBLIC_PH_API_HOST` optionally overrides the ingestion host, for local tests
// against a stub; production uses the managed proxy set in posthog-loader.ts.

import {
  CONSENT_CHANGE_EVENT,
  createAnalytics,
  type AnalyticsDocument,
  type AnalyticsWindow,
} from "./analytics-core.ts";

const analytics = createAnalytics({
  window: window as unknown as AnalyticsWindow,
  document: document as unknown as AnalyticsDocument,
  token: import.meta.env.PUBLIC_PH_PROJECT_API_KEY,
  apiHost: import.meta.env.PUBLIC_PH_API_HOST || undefined,
});

export { CONSENT_CHANGE_EVENT };
export const getConsent = analytics.getConsent;
export const setConsent = analytics.setConsent;
export const initAnalytics = analytics.init;
