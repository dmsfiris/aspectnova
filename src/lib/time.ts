// src/lib/time.ts
// Lightweight date/time helpers used across the app (no app-specific types).

/* ---------------------------------- Basics ---------------------------------- */

export function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/**
 * Start of week.
 * @param d Base date
 * @param weekStart Week start day (0=Sun..6=Sat). Defaults to 1 (Monday).
 */
export function startOfWeek(d = new Date(), weekStart: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1) {
  const x = startOfDay(d);
  const dow = x.getDay(); // 0=Sun..6=Sat
  const delta = (7 + (dow - weekStart)) % 7;
  x.setDate(x.getDate() - delta);
  return x;
}

export function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function daysInMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/* -------------------------------- Formatting -------------------------------- */

export function ymdLocal(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function fmtHM(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Format seconds as MM:SS (always 2-digit minutes/seconds).
 * Negative values are clamped to 0.
 */
export function fmtMMSS(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec || 0));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${pad(m)}:${pad(ss)}`;
}

/**
 * Simple date label (non-i18n). Map in UI to i18n strings if needed.
 */
export function fmtDateLabel(d: Date) {
  const today = startOfDay(new Date());
  const x = startOfDay(d);
  const diff = Math.round((today.getTime() - x.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/* ------------------------------- HH:MM helpers ------------------------------- */

export function parseHHMM(s: string): { h: number; m: number } | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec((s || "").trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  return { h, m: mm };
}

export function fmtHHMM(h: number, m: number) {
  return `${pad(Math.max(0, Math.min(23, Math.floor(h))))}:${pad(
    Math.max(0, Math.min(59, Math.floor(m)))
  )}`;
}

/**
 * Given "HH:MM", returns the next Date occurrence in the future (today or tomorrow)
 * in local timezone.
 */
export function nextOccurrenceFromHHMM(hhmm: string, from = new Date()) {
  const parsed = parseHHMM(hhmm);
  const base = new Date(from);
  if (!parsed) return null;
  const next = new Date(base);
  next.setHours(parsed.h, parsed.m, 0, 0);
  if (next.getTime() <= base.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

/* ------------------------------- Range utils -------------------------------- */

export function clampDateToRange(d: Date, min: Date, max: Date) {
  const t = d.getTime();
  return new Date(Math.min(max.getTime(), Math.max(min.getTime(), t)));
}

export function isWithin(start: Date, end: Date, target: Date) {
  const t = target.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

/** Inclusive day range iterator (local). */
export function* eachDay(from: Date, to: Date) {
  let d = startOfDay(from);
  const end = startOfDay(to);
  while (d.getTime() <= end.getTime()) {
    yield d;
    d = addDays(d, 1);
  }
}

/* ------------------------------- Convenience -------------------------------- */

export function getTodayWindow(now = new Date()) {
  return { from: startOfDay(now), to: now };
}

export function getThisWeekWindow(
  now = new Date(),
  weekStart: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1
) {
  return { from: startOfWeek(now, weekStart), to: now };
}

export function getThisMonthWindow(now = new Date()) {
  return { from: startOfMonth(now), to: now };
}
