import type { UsageMap } from "../shared/types";
import { formatTime } from "../shared/format";

interface UsageListProps {
  usage: UsageMap;
}

// the "Usage" panel, sorted by most-used first
export default function UsageList({ usage }: UsageListProps) {
  const entries = Object.entries(usage)
    .filter(([host]) => host && host !== "undefined")
    .sort((a, b) => b[1] - a[1]);

  return (
    <div id="usage">
      <p>Usage</p>
      <ul id="list-of-screen-time">
        {entries.map(([host, seconds]) => (
          <li key={host}>
            Website: {host}, usage: {formatTime(seconds)}
          </li>
        ))}
      </ul>
    </div>
  );
}
