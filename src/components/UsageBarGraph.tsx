import { useLayoutEffect, useRef, useState } from "react";
import type { BundledCategories } from "../shared/categories";
import { formatTime } from "../shared/format";
import { displayName } from "../shared/siteName";

interface UsageBarGraphProps {
  // pre-filtered (>5 min) and sorted descending by the caller
  entries: [string, number][];
  // sum of every non-time-limited entry at or under 5 minutes; rendered as
  // one extra "Other" bar to the right of the rest, 0 = omit it
  otherSeconds: number;
  bundled: BundledCategories;
}

interface BarItem {
  key: string;
  seconds: number;
  label: string;
  isOther?: boolean;
}

// fixed bar+label column width; the gap between columns is what flexes
const COL_WIDTH = 36;
const MIN_GAP = 2;
const MAX_GAP = 24;

// given the measured available width and how many entries there are, decide
// how many get their own bar vs. fold into "Other", and how much gap to
// spread them with -- never scrolls, everything always fits the width.
function layoutBars(width: number, realCount: number, hasExistingOther: boolean) {
  const maxCols = Math.max(1, Math.floor((width + MIN_GAP) / (COL_WIDTH + MIN_GAP)));
  const totalIfAll = realCount + (hasExistingOther ? 1 : 0);

  let shownReal: number;
  let needsOtherBar: boolean;
  if (totalIfAll <= maxCols) {
    shownReal = realCount;
    needsOtherBar = hasExistingOther;
  } else {
    // reserve one column for "Other" once everything no longer fits
    shownReal = Math.max(0, maxCols - 1);
    needsOtherBar = true;
  }

  const totalCols = shownReal + (needsOtherBar ? 1 : 0);
  const gap =
    totalCols > 1
      ? Math.min(MAX_GAP, Math.max(MIN_GAP, (width - totalCols * COL_WIDTH) / (totalCols - 1)))
      : MAX_GAP;

  return { shownReal, needsOtherBar, gap };
}

// vertical column bar graph (Google Forms style), hand-rolled with CSS --
// no chart library in this project. hover tooltip is pure CSS (opacity on
// :hover) so it scales to any number of bars with no per-bar React state.
//
// bars and labels are two separate flex rows (not one row of bar+label
// columns) sharing identical column sizing, so the x-axis line -- a border
// on the bars row -- spans the full content width as one continuous line.
export default function UsageBarGraph({ entries, otherSeconds, bundled }: UsageBarGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  const hasExistingOther = otherSeconds > 0;
  // recompute the measured width whenever the underlying data changes shape
  // (not on every render -- entries.length/hasExistingOther are stable
  // primitives, unlike the entries array's identity)
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // clientWidth includes this element's own left/right padding, but the
    // columns render inside that padding -- subtract it so the layout math
    // sees the true available content width, not the padded box width
    // (using the padded value made the row overflow the right padding
    // while the left stayed correctly inset, looking off-center)
    const style = getComputedStyle(el);
    const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    setWidth(el.clientWidth - paddingX);
  }, [entries.length, hasExistingOther]);

  if (entries.length === 0 && !hasExistingOther) return null;

  const { shownReal, needsOtherBar, gap } = layoutBars(width, entries.length, hasExistingOther);

  const shown = entries.slice(0, shownReal);
  const overflowSeconds = entries
    .slice(shownReal)
    .reduce((sum, [, seconds]) => sum + seconds, 0);
  const combinedOtherSeconds = otherSeconds + overflowSeconds;

  const items: BarItem[] = shown.map(([key, seconds]) => ({
    key,
    seconds,
    label: displayName(key, bundled),
  }));
  if (needsOtherBar && combinedOtherSeconds > 0) {
    items.push({ key: "__other__", seconds: combinedOtherSeconds, label: "Other", isOther: true });
  }

  const max = items.length > 0 ? Math.max(...items.map((item) => item.seconds)) : 1;

  return (
    <div className="bar-graph" ref={containerRef}>
      {width > 0 && (
        <>
          <div className="bar-graph-bars" style={{ gap: `${gap}px` }}>
            {items.map((item) => (
              <div className="bar-col" key={item.key}>
                <div className="bar" style={{ height: `${(item.seconds / max) * 100}%` }}>
                  {/* tooltip always shows the exact tracked URL, even when
                      the label below shows a friendly name -- "Other" has
                      no single URL, so its tooltip just spells out what it is */}
                  <div className="bar-tooltip">
                    {item.isOther ? "Other (remaining sites)" : item.key} — {formatTime(item.seconds)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="bar-graph-labels" style={{ gap: `${gap}px` }}>
            {items.map((item) => (
              <div className="bar-label" key={item.key} title={item.isOther ? undefined : item.key}>
                {item.label}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
