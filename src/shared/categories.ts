import type { CategoryId, SiteCategoriesMap } from "./types";

// the bundled domain->category defaults shipped in public/categories.json
export interface BundledCategories {
  categories: string[];
  domains: Record<string, CategoryId>;
  names: Record<string, string>; // domain -> friendly display name, e.g. "instagram.com" -> "Instagram"
}

export const EMPTY_BUNDLED: BundledCategories = { categories: [], domains: {}, names: {} };

export async function loadBundledCategories(): Promise<BundledCategories> {
  try {
    const resp = await fetch(chrome.runtime.getURL("categories.json"));
    return (await resp.json()) as BundledCategories;
  } catch {
    return EMPTY_BUNDLED;
  }
}

// which category a (normalized) hostname counts toward: user override first
// (null = explicitly uncategorized), then the bundled list (suffix match so
// m.youtube.com matches youtube.com). mirrors the background's resolver.
export function resolveHostCategory(
  host: string,
  overrides: SiteCategoriesMap,
  bundled: BundledCategories
): CategoryId | null {
  if (!host) return null;
  if (host in overrides) return overrides[host];
  for (const [domain, category] of Object.entries(bundled.domains)) {
    if (host === domain || host.endsWith("." + domain)) return category;
  }
  return null;
}
