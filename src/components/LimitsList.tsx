import type { LimitsMap } from "../shared/types";
import { formatTime } from "../shared/format";

interface LimitsListProps {
  limits: LimitsMap;
  onReset: () => void;
  focusLocked: boolean;
}

// the "Time Limits Set" panel: entries with an actual limit or an outright block
export default function LimitsList({ limits, onReset, focusLocked }: LimitsListProps) {
  const entries = Object.entries(limits).filter(
    ([, value]) =>
      value && typeof value === "object" && (Number(value.timeLimit) > 0 || value.blocked)
  );

  return (
    <div id="limits">
      <p>Time Limits Set</p>
      <ul id="list-of-limits">
        {entries.map(([host, value]) => (
          <li key={host}>
            Website: {host},{" "}
            {value.blocked
              ? "completely blocked"
              : `time limit: ${formatTime(Number(value.timeLimit))}`}
            {value.redirect ? `, redirect: ${value.redirect}` : ""}
          </li>
        ))}
      </ul>
      {/* removing limits counts as modifying them: no reset during focus mode */}
      {!focusLocked && (
        <button id="reset" onClick={onReset}>
          Reset Limits
        </button>
      )}
    </div>
  );
}
