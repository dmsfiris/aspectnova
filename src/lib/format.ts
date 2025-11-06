export function fmtCompactDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  if (s < 60) return `${s}s`;
  return `${Math.round(s / 60)} min`;
}
