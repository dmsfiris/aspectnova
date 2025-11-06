// src/lib/validate.ts

/** True if string matches 24h "HH:MM" (00:00–23:59). */
export function isValidTimeHHMM(s: string): boolean {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec((s || "").trim());
  return !!m;
}

/** Parse a positive integer safely; returns null if invalid. */
export function safeParsePositiveInt(
  value: string | number | null | undefined
): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : parseInt(String(value).trim(), 10);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/** Clamp an integer into [min, max]. If null, returns null. */
export function clampInt(n: number | null, min: number, max: number): number | null {
  if (n === null) return null;
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.min(hi, Math.max(lo, Math.floor(n)));
}

/** True if integer is within [min, max]. */
export function isIntInRange(n: number, min: number, max: number): boolean {
  if (!Number.isFinite(n)) return false;
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.floor(n) >= lo && Math.floor(n) <= hi;
}

/** Non-empty string (after trim). */
export function isNonEmptyString(s: unknown): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

/** Basic ISO date-time validation (YYYY-MM-DD or full ISO). */
export function isIsoDateLike(s: string): boolean {
  if (!isNonEmptyString(s)) return false;
  // Accept "YYYY-MM-DD" or full ISO "YYYY-MM-DDTHH:mm:ss.sssZ"
  return /^\d{4}-\d{2}-\d{2}($|T)/.test(s) && !isNaN(Date.parse(s));
}

/** Convenience: parse minutes input, clamp to [min,max]; returns null if empty/invalid. */
export function parseMinutesClamped(
  value: string | number | null | undefined,
  min: number,
  max: number
): number | null {
  const n = safeParsePositiveInt(value);
  return n === null ? null : clampInt(n, min, max);
}
