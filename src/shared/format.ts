// format seconds as "H hours, M minutes, S seconds", omitting zero parts.
// rounds to whole seconds so the per-second live ticker reads cleanly.
export function formatTime(totalSeconds: number): string {
  const total = Math.round(Number(totalSeconds) || 0);
  const hours = Math.floor(total / (60 * 60));
  const minutes = Math.floor((total - hours * 60 * 60) / 60);
  const seconds = total - hours * 60 * 60 - minutes * 60;
  const parts: string[] = [];
  if (hours !== 0) parts.push(`${hours} hours`);
  if (minutes !== 0) parts.push(`${minutes} minutes`);
  if (seconds !== 0 || parts.length === 0) parts.push(`${seconds} seconds`);
  return parts.join(", ");
}

// compact "3h 21m total" form for the header's total-today readout -- no
// seconds once a minute has passed (only ticks per-second below 1m, since
// that's the only range where a live per-second update is visible at this
// granularity); distinct from formatTime's verbose spelled-out form used
// elsewhere for limits/usage rows.
export function formatTotalTime(totalSeconds: number): string {
  const total = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  if (total < 60) return `${total}s total`;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const parts: string[] = [];
  if (hours !== 0) parts.push(`${hours}h`);
  if (minutes !== 0 || hours === 0) parts.push(`${minutes}m`);
  return `${parts.join(" ")} total`;
}

// decompose total seconds into hour/minute/second parts (pure conversion,
// not clamped -- a pre-existing 24h-exactly limit decomposes to h=24 so no
// value is silently lost; TimeDurationSelect handles bounding that for display)
export function splitTime(totalSeconds: number): { h: number; m: number; s: number } {
  const total = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { h, m, s };
}
