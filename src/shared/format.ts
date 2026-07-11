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
