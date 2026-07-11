import type { CategoriesMap, LimitsMap, SiteCategoriesMap, UsageMap } from "../shared/types";
import type { BundledCategories } from "../shared/categories";
import { formatTime } from "../shared/format";
import { displayName } from "../shared/siteName";
import { isTimeLimited } from "../shared/timeLimited";
import UsageBarGraph from "./UsageBarGraph";

const BAR_THRESHOLD_SECONDS = 5 * 60;

interface UsageSectionProps {
  usage: UsageMap;
  limits: LimitsMap;
  categories: CategoriesMap;
  siteCategories: SiteCategoriesMap;
  bundled: BundledCategories;
}

// the "Usage" panel: everything NOT already shown as a progress bar above.
// entries over 5 minutes become a bar graph (sorted descending); the rest
// are listed as plain stacked text.
export default function UsageSection({
  usage,
  limits,
  categories,
  siteCategories,
  bundled,
}: UsageSectionProps) {
  const entries = Object.entries(usage)
    .filter(([host]) => host && host !== "undefined")
    .filter(([key]) => !isTimeLimited(key, limits, categories, siteCategories, bundled))
    .sort((a, b) => b[1] - a[1]);

  const barEntries = entries.filter(([, seconds]) => seconds > BAR_THRESHOLD_SECONDS);
  const listEntries = entries.filter(([, seconds]) => seconds <= BAR_THRESHOLD_SECONDS);

  if (entries.length === 0) return null;

  return (
    <div id="usage" className="panel">
      <p className="panel-title">Usage</p>
      <UsageBarGraph entries={barEntries} bundled={bundled} />
      <ul id="list-of-screen-time">
        {listEntries.map(([host, seconds]) => (
          <li key={host} title={host}>
            <strong>{displayName(host, bundled)}</strong>: {formatTime(seconds)}
          </li>
        ))}
      </ul>
    </div>
  );
}
