// shape of one entry in the chrome.storage.local "limits" object,
// keyed by hostname (mirrors WebsiteSettings in the old popup.js and
// the inline objects background.js creates)
export interface SiteLimit {
  websiteName: string;
  timeLimit: number; // in seconds, 0 = no limit set
  timeUsage: number; // in seconds
  redirect: string; // website URL to redirect to once blocked, if specified
  blocked?: boolean; // outright blocked ("block this website completely"), independent of time
}

// bounds for user-entered time limits (site and category)
export const MIN_LIMIT_SECONDS = 1;
export const MAX_LIMIT_SECONDS = 24 * 60 * 60;

export type LimitsMap = Record<string, SiteLimit>;

// hostname -> seconds used today, what the background sends the popup
export type UsageMap = Record<string, number>;

// the six built-in categories shipped in public/categories.json
export const BUILT_IN_CATEGORIES = [
  "entertainment",
  "social",
  "news",
  "shopping",
  "games",
  "productivity",
] as const;

export type CategoryId = string;

// a category budget in the chrome.storage.local "categories" object; an
// entry exists only once the user sets a limit for that category
export interface CategoryLimit {
  name: string;
  timeLimit: number; // in seconds
  timeUsage: number; // in seconds, combined across all sites in the category
  redirect?: string; // website to redirect to when the category budget blocks a site
}

export type CategoriesMap = Record<CategoryId, CategoryLimit>;

// user overrides in "siteCategories": hostname -> category, or null for
// "explicitly uncategorized" (beats the bundled default)
export type SiteCategoriesMap = Record<string, CategoryId | null>;

// what the background sends the popup (pushes and getScreenTime responses)
export interface UsagePayload {
  sites: UsageMap;
  categories: CategoriesMap;
}

// messages pushed from background.js to the popup
export type BackgroundMessage =
  | { action: "list-of-screen-time"; data: UsagePayload }
  | { action: "reset-usage" };
