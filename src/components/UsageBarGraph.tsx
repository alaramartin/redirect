import type { BundledCategories } from "../shared/categories";
import { formatTime } from "../shared/format";
import { displayName } from "../shared/siteName";

interface UsageBarGraphProps {
  // pre-filtered (>5 min) and sorted descending by the caller
  entries: [string, number][];
  bundled: BundledCategories;
}

// vertical column bar graph (Google Forms style), hand-rolled with CSS --
// no chart library in this project. hover tooltip is pure CSS (opacity on
// :hover) so it scales to any number of bars with no per-bar React state.
export default function UsageBarGraph({ entries, bundled }: UsageBarGraphProps) {
  if (entries.length === 0) return null;
  const max = entries[0][1]; // already sorted desc

  return (
    <div className="bar-graph">
      {entries.map(([key, seconds]) => (
        <div className="bar-col" key={key}>
          <div className="bar" style={{ height: `${(seconds / max) * 100}%` }}>
            {/* tooltip always shows the exact tracked URL, even when the
                label below shows a friendly name */}
            <div className="bar-tooltip">
              {key} — {formatTime(seconds)}
            </div>
          </div>
          <div className="bar-label" title={key}>
            {displayName(key, bundled)}
          </div>
        </div>
      ))}
    </div>
  );
}
