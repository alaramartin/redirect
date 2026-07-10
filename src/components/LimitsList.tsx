import type { LimitsMap } from "../shared/types";
import { formatTime } from "../shared/format";

interface LimitsListProps {
  limits: LimitsMap;
  onReset: () => void;
}

// the "Time Limits Set" panel: only entries with an actual limit are shown
export default function LimitsList({ limits, onReset }: LimitsListProps) {
  const entries = Object.entries(limits).filter(
    ([, value]) => value && typeof value === "object" && Number(value.timeLimit) > 0
  );

  return (
    <div id="limits">
      <p>Time Limits Set</p>
      <ul id="list-of-limits">
        {entries.map(([host, value]) => (
          <li key={host}>
            Website: {host}, time limit: {formatTime(Number(value.timeLimit))}
            {value.redirect ? `, redirect: ${value.redirect}` : ""}
          </li>
        ))}
      </ul>
      <button id="reset" onClick={onReset}>
        Reset Limits
      </button>
    </div>
  );
}
