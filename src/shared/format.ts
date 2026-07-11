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
