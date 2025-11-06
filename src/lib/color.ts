// src/lib/color.ts

/** Parse a #RRGGBB (or #RGB) hex string to { r,g,b }. Returns null on invalid. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const s = hex.trim().replace(/^#/, "");
  const full =
    s.length === 3
      ? s
          .split("")
          .map(c => c + c)
          .join("")
      : s;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return { r, g, b };
}

/** Convert #hex to an rgba() string with the given alpha (0–1). Falls back to input if invalid. */
export function rgbaFromHex(hex: string, alpha = 1): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const a = clamp(alpha, 0, 1);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

/**
 * Create a soft **tint** fill from a solid hex color (great for chips/soft buttons).
 * Example: tint("#3B82F6", 0.12) → "rgba(59, 130, 246, 0.12)"
 */
export function tint(hex: string, alpha = 0.12): string {
  return rgbaFromHex(hex, alpha);
}

/** Clamp a number to [min, max]. */
export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Mix two hex colors by `t` (0–1). t=0 → a, t=1 → b. */
export function mix(hexA: string, hexB: string, t: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return hexA;
  const k = clamp(t, 0, 1);
  const r = Math.round(a.r + (b.r - a.r) * k);
  const g = Math.round(a.g + (b.g - a.g) * k);
  const b2 = Math.round(a.b + (b.b - a.b) * k);
  return rgbToHex(r, g, b2);
}

/** Lighten a hex color by percentage (0–1). 0.2 = +20% toward white. */
export function lighten(hex: string, amount: number): string {
  return mix(hex, "#FFFFFF", clamp(amount, 0, 1));
}

/** Darken a hex color by percentage (0–1). 0.2 = +20% toward black. */
export function darken(hex: string, amount: number): string {
  return mix(hex, "#000000", clamp(amount, 0, 1));
}

/** Convert r,g,b (0–255) to #RRGGBB hex. */
export function rgbToHex(r: number, g: number, b: number): string {
  const to2 = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`.toUpperCase();
}

/** Change alpha of a hex color (returns rgba string). Alias for rgbaFromHex. */
export function withAlpha(hex: string, alpha: number): string {
  return rgbaFromHex(hex, alpha);
}

/** Contrast helper: returns either `onLight` or `onDark` based on luminance of background hex. */
export function readableOn(hexBg: string, onLight = "#111111", onDark = "#FFFFFF") {
  const rgb = hexToRgb(hexBg);
  if (!rgb) return onLight;
  // Relative luminance approximation (gamma-corrected sRGB)
  const lum = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lum(rgb.r) + 0.7152 * lum(rgb.g) + 0.0722 * lum(rgb.b);
  return L > 0.5 ? onLight : onDark;
}
