// format seconds as "H hours, M minutes, S seconds", omitting zero parts
// (ported unchanged from the old popup.js formatTime)
export function formatTime(totalSeconds: number): string {
  const total = Number(totalSeconds) || 0;
  const hours = Math.floor(total / (60 * 60));
  const minutes = Math.floor((total - hours * 60 * 60) / 60);
  const seconds = (total - hours * 60 * 60 - minutes * 60).toFixed(2);
  let stringToPrint = "";
  stringToPrint += hours !== 0 ? `${hours} hours, ` : "";
  stringToPrint += minutes !== 0 ? `${minutes} minutes, ` : "";
  stringToPrint += Number(seconds) !== 0 ? `${seconds} seconds` : "";
  return stringToPrint;
}
