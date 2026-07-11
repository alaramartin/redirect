import type { CategoriesMap, FocusMode, LimitsMap, SiteCategoriesMap, UsagePayload } from "./types";

export async function loadLimits(): Promise<LimitsMap> {
  const result = await chrome.storage.local.get("limits");
  return (result.limits as LimitsMap) ?? {};
}

export async function saveLimits(limits: LimitsMap): Promise<void> {
  await chrome.storage.local.set({ limits });
}

export async function loadCategories(): Promise<CategoriesMap> {
  const result = await chrome.storage.local.get("categories");
  return (result.categories as CategoriesMap) ?? {};
}

export async function saveCategories(categories: CategoriesMap): Promise<void> {
  await chrome.storage.local.set({ categories });
}

export async function loadSiteCategories(): Promise<SiteCategoriesMap> {
  const result = await chrome.storage.local.get("siteCategories");
  return (result.siteCategories as SiteCategoriesMap) ?? {};
}

export async function saveSiteCategories(siteCategories: SiteCategoriesMap): Promise<void> {
  await chrome.storage.local.set({ siteCategories });
}

// focus-mode end time in ms epoch, 0 if none was ever set (a past endTime
// just means focus mode is over -- callers compare against Date.now())
export async function loadFocusEnd(): Promise<number> {
  const result = await chrome.storage.local.get("focus");
  return Number((result.focus as FocusMode | undefined)?.endTime) || 0;
}

export async function saveFocusEnd(endTime: number): Promise<void> {
  await chrome.storage.local.set({ focus: { endTime } });
}

// the authoritative "are limits locked right now?" check: always reads
// storage fresh so a stale popup can't slip a save through
export async function isFocusLocked(): Promise<boolean> {
  return (await loadFocusEnd()) > Date.now();
}

// ask the background for today's usage; it checks for a missed daily
// reset before responding, so this is always fresh
export async function requestUsage(): Promise<UsagePayload> {
  try {
    const response = await chrome.runtime.sendMessage({ action: "getScreenTime" });
    return (response?.data as UsagePayload) ?? { sites: {}, categories: {} };
  } catch {
    return { sites: {}, categories: {} };
  }
}
