import { formatTime } from "../shared/format";

interface ProgressBarProps {
  value: number; // seconds used
  max: number; // seconds allowed, 0 when blocked has no time limit
  blocked?: boolean;
}

// a site/category's usage against its limit, filled to 100% at the full
// limit. an outright block has no meaningful ratio (timeLimit is 0), so it
// gets a distinct fixed state instead of a fake percentage.
export default function ProgressBar({ value, max, blocked }: ProgressBarProps) {
  if (blocked) {
    return <div className="progress-track blocked" title="Blocked" />;
  }

  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="progress-track" title={`${formatTime(value)} / ${formatTime(max)}`}>
      <div
        className={pct >= 100 ? "progress-fill over-limit" : "progress-fill"}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
