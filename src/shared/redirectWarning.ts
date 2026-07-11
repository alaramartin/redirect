import type { CategoriesMap, LimitsMap, SiteCategoriesMap } from "./types";
import type { BundledCategories } from "./categories";
import { resolveHostCategory } from "./categories";

// returns a soft-warning message if the redirect target may itself be blocked
// at redirect time, or null if it looks safe. hard errors (invalid input,
// outright-blocked targets) are the forms' responsibility, not this helper's.
export function redirectTargetWarning(
  targetHost: string,
  limits: LimitsMap,
  categories: CategoriesMap,
  siteCategories: SiteCategoriesMap,
  bundled: BundledCategories,
  settingCategory?: string // the category currently being given a limit, if any
): string | null {
  // individual rules override category rules, so a target with its own limit
  // is governed by that limit alone
  if (Number(limits[targetHost]?.timeLimit) > 0) {
    return `${targetHost} has a time limit applied and may itself be blocked at the time of redirecting.`;
  }
  const cat = resolveHostCategory(targetHost, siteCategories, bundled);
  if (!cat) return null;
  if (settingCategory && cat === settingCategory) {
    return `${targetHost} is in the ${settingCategory} category, so this very limit may block it at the time of redirecting.`;
  }
  if (Number(categories[cat]?.timeLimit) > 0) {
    return `${targetHost} is in the ${cat} category, which has a time limit applied — it may be blocked at the time of redirecting.`;
  }
  return null;
}
