import type { UsageMap } from "../shared/types";
import type { BundledCategories } from "../shared/categories";
import { formatTime } from "../shared/format";
import { displayName } from "../shared/siteName";
import UsageBarGraph from "./UsageBarGraph";

const BAR_THRESHOLD_SECONDS = 5 * 60;

interface UsageSectionProps {
  usage: UsageMap;
  bundled: BundledCategories;
}

// the "Usage" panel: a bar graph of every site with over 5 minutes of usage
// today (with everything smaller folded into one "Other" bar), regardless of
// whether it's also time-limited or blocked, plus a full reference list of
// every tracked website's usage underneath.
export default function UsageSection({ usage, bundled }: UsageSectionProps) {
  // limit entries stay in storage across days with their usage zeroed by the
  // daily reset, so skip anything that wouldn't show at least 1 second today
  const allEntries = Object.entries(usage)
    .filter(([host, seconds]) => host && host !== "undefined" && Math.round(seconds) >= 1)
    .sort((a, b) => b[1] - a[1]);

  if (allEntries.length === 0) return null;

  const barEntries = allEntries.filter(([, seconds]) => seconds > BAR_THRESHOLD_SECONDS);
  const otherSeconds = allEntries
    .filter(([, seconds]) => seconds <= BAR_THRESHOLD_SECONDS)
    .reduce((sum, [, seconds]) => sum + seconds, 0);

  return (
    <div id="usage" className="panel">
      <p className="panel-title">Usage</p>
      <UsageBarGraph entries={barEntries} otherSeconds={otherSeconds} bundled={bundled} />
      <ul id="list-of-screen-time">
        {allEntries.map(([host, seconds]) => (
          <li key={host} title={host}>
            <strong>{displayName(host, bundled)}</strong>: {formatTime(seconds)}
          </li>
        ))}
      </ul>
    </div>
  );
}
