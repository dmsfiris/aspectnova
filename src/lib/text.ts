// src/lib/text.ts
// Locale helpers for casing and numerals in UI text.

// --- Greek uppercase without tonos (keep/add diaeresis where appropriate) ---
const MAP_SIMPLE: Record<string, string> = {
  ά: "Α",
  έ: "Ε",
  ή: "Η",
  ί: "Ι",
  ό: "Ο",
  ύ: "Υ",
  ώ: "Ω",
  α: "Α",
  ε: "Ε",
  η: "Η",
  ι: "Ι",
  ο: "Ο",
  υ: "Υ",
  ω: "Ω",
  ς: "Σ",
  σ: "Σ",

  // keep diaeresis on ϊ/ϋ and combos ΐ/ΰ -> Ϊ/Ϋ
  ϊ: "Ϊ",
  ϋ: "Ϋ",
  ΐ: "Ϊ",
  ΰ: "Ϋ",

  // uppercase with tonos -> drop tonos
  Ά: "Α",
  Έ: "Ε",
  Ή: "Η",
  Ί: "Ι",
  Ό: "Ο",
  Ύ: "Υ",
  Ώ: "Ω",
  // keep uppercase diaeresis
  Ϊ: "Ϊ",
  Ϋ: "Ϋ"
};

// Heuristics to add diaeresis on I/Y in common hiatus cases when uppercasing.
const HIATUS_PATTERNS: [RegExp, string][] = [
  [/άι/gi, "ΑΪ"],
  [/έι/gi, "ΕΪ"],
  [/όι/gi, "ΟΪ"],
  [/άυ/gi, "ΑΫ"],
  [/έυ/gi, "ΕΫ"],
  [/όυ/gi, "ΟΫ"],
  [/Άι/g, "ΑΪ"],
  [/Έι/g, "ΕΪ"],
  [/Όι/g, "ΟΪ"],
  [/Άυ/g, "ΑΫ"],
  [/Έυ/g, "ΕΫ"],
  [/Όυ/g, "ΟΫ"]
];

export function greekUpperNoTonos(input: string): string {
  if (!input) return input;
  let s = input;
  for (const [re, rep] of HIATUS_PATTERNS) s = s.replace(re, rep);
  // Strip combining acute/tonos marks defensively.
  s = s
    .normalize("NFD")
    .replace(/\u0301/g, "")
    .replace(/\u0384/g, "");
  // Map character-by-character; fallback to default uppercase.
  let out = "";
  for (const ch of s) out += MAP_SIMPLE[ch] ?? ch.toUpperCase();
  return out;
}

// Locale-aware uppercase for headings, badges, etc.
export function toUpperLocalized(text: string, lang: string): string {
  if (!text) return text;
  if (lang === "el") return greekUpperNoTonos(text); // Greek special rules
  if (lang === "hi") return text; // Hindi: no case
  return text.toUpperCase(); // Default
}

// --- Devanagari numerals for Hindi ---
const DEVANAGARI_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];

/** Convert ASCII digits 0–9 to Devanagari digits ०–९ */
export function toDevanagariNumber(n: number | string): string {
  return String(n).replace(/\d/g, d => DEVANAGARI_DIGITS[Number(d)]);
}

/** Format a number according to the language (Devanagari for Hindi; passthrough otherwise). */
export function formatNumberForLang(value: number | string, lang: string): string {
  if (lang === "hi") return toDevanagariNumber(value);
  return String(value);
}

/** Replace compact duration unit tokens ('m', 's') with localized labels, then localize digits. */
export function localizeCompactDuration(
  compact: string,
  lang: string,
  minutesLabel: string,
  secondsLabel: string
): string {
  // Example input: "12m 5s" or "3m"
  const out = compact
    .replace(/(\d+)\s*min\b/g, `$1 ${minutesLabel}`)
    .replace(/(\d+)\s*s\b/g, `$1 ${secondsLabel}`);
  // Finally, localize digits (e.g., to Devanagari for Hindi)
  return formatNumberForLang(out, lang);
}
