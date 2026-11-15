// Site-specific globals (not part of AstroPaper).
declare global {
  interface ImportMetaEnv {
    /** PostHog project token. Without it PostHog never loads. */
    readonly PUBLIC_PH_PROJECT_API_KEY?: string;
    /** Optional ingestion host override (local tests). Defaults to the managed proxy. */
    readonly PUBLIC_PH_API_HOST?: string;
  }
}

export {};
