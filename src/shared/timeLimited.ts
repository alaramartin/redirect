import type { CategoriesMap, LimitsMap, SiteCategoriesMap } from "./types";
import type { BundledCategories } from "./categories";
import { resolveHostCategory } from "./categories";
import { hostOfKey } from "./normalize";

// true if a usage key is already shown as a progress bar in the Time Limits
// section -- either its own entry has a limit/block, or its host currently
// falls under a category that has a limit set (category membership is
// host-based even for a path-scoped key, e.g. "youtube.com/shorts" checks
// the "youtube.com" category assignment). Used to keep the Usage section
// from repeating anything already covered above.
export function isTimeLimited(
  key: string,
  limits: LimitsMap,
  categories: CategoriesMap,
  siteCategories: SiteCategoriesMap,
  bundled: BundledCategories
): boolean {
  const own = limits[key];
  if (own && (Number(own.timeLimit) > 0 || own.blocked)) return true;

  const cat = resolveHostCategory(hostOfKey(key), siteCategories, bundled);
  if (cat && Number(categories[cat]?.timeLimit) > 0) return true;

  return false;
}
