// shape of one entry in the chrome.storage.local "limits" object,
// keyed by hostname (mirrors WebsiteSettings in the old popup.js and
// the inline objects background.js creates)
export interface SiteLimit {
  websiteName: string;
  timeLimit: number; // in seconds, 0 = no limit set
  timeUsage: number; // in seconds
  redirect: string; // website URL to redirect to, if specified (currently unused by blocking)
}

export type LimitsMap = Record<string, SiteLimit>;

// hostname -> seconds used today, what the background sends the popup
export type UsageMap = Record<string, number>;

// messages pushed from background.js to the popup
export type BackgroundMessage =
  | { action: "list-of-screen-time"; data: UsageMap }
  | { action: "reset-usage" };
