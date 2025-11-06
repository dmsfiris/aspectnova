/**
 * Copyright (c) 2025 AspectSoft
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
 
import { DEMO_IMAGE_PROVIDER } from "@/config/env";

/** Providers your app supports */
export type DemoImageProvider =
  | "picsum"
  | "unsplash"
  | "dummyimage"
  | "placehold"
  | "data";

/** Small curated set of Unsplash photo IDs (SFW / neutral) */
const UNSPLASH_IDS: string[] = [
  "1620287341056-49a2f1ab2fdc",
  "1675145172812-f78b6085e790",
  "1647320293733-92affa4fa39c",
  "1675557009285-b55f562641b9",
  "1507842217343-583bb7270b66",
  "1519389950473-47ba0277781c",
  "1460925895917-afdab827c52f"
];

/** Deterministic tiny hash for seeding (FNV-1a-ish) */
function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Make a pleasant deterministic hex color from a seed */
function colorFromSeed(seed: string): { bg: string; fg: string } {
  const h = hashSeed(seed);
  const hue = h % 360;
  const sat = 55 + (h % 30); // 55–85
  const lit = 60;

  const c = (1 - Math.abs(2 * (lit / 100) - 1)) * (sat / 100);
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lit / 100 - c / 2;

  let r = 0,
    g = 0,
    b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");

  const bg = `${toHex(r)}${toHex(g)}${toHex(b)}`;
  const fg = "111111"; // near-black for contrast
  return { bg, fg };
}

/** Inline SVG (same-origin, no network / no ORB) */
function svgDataUrl(w: number, h: number, label: string) {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  const text = label.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const fontSize = Math.max(10, Math.floor(Math.min(W, H) / 8));
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}'>` +
    `<rect width='100%' height='100%' fill='#e5e7eb'/>` +
    `<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='system-ui,Roboto,Arial' font-size='${fontSize}' fill='#111'>${text}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${svg}`;
}

/** Strict check: real Unsplash photo IDs look like `<digits>-<hex>` (both long). */
export function looksLikeRealUnsplashId(s: string | undefined | null): boolean {
  // e.g. 1620287341056-49a2f1ab2fdc
  return !!s && /^\d{10,}-[0-9a-f]{10,}$/i.test(s);
}

/** Extract Unsplash id from pathname like `/photo-<id>` */
export function extractUnsplashIdFromPath(pathname: string): string | null {
  const m = pathname.match(/\/photo-([^/?]+)/);
  return m && m[1] ? m[1] : null;
}

/** Does the URL belong to one of our demo providers (or inline data image)? */
export function isDemoProviderUrl(u?: string | null): boolean {
  if (!u) return false;
  try {
    if (u.startsWith("data:image/")) return true;
    const url = new URL(
      u,
      typeof window !== "undefined" ? window.location.origin : "https://local"
    );
    const host = url.hostname.toLowerCase();
    return (
      host.includes("picsum.photos") ||
      host.includes("images.unsplash.com") ||
      host.includes("dummyimage.com") ||
      host.includes("placehold.co")
    );
  } catch {
    return false;
  }
}

/**
 * Extract a deterministic seed from a demo URL so different sizes render the *same* visual.
 * Priority:
 *  1) `?seed=` query param (used by dummyimage/placehold we build)
 *  2) picsum: `/seed/<seed>/<w>/<h>`
 *  3) unsplash: `/photo-<id>`
 *  4) dummyimage/placehold: `text=` as fallback (not ideal, but deterministic)
 *  5) otherwise, return the original string to keep hashing stable
 *
 * For data/blob/file/asset URLs we just return the URL itself as the seed.
 */
export function extractDemoSeed(src?: string | null): string | undefined {
  if (!src) return undefined;

  // Non-network schemes → treat as deterministic seed
  if (
    src.startsWith("data:image/") ||
    src.startsWith("blob:") ||
    src.startsWith("file:") ||
    src.startsWith("asset:")
  ) {
    return src;
  }

  try {
    const u = new URL(
      src,
      typeof window !== "undefined" ? window.location.origin : "https://local"
    );
    const host = u.hostname.toLowerCase();
    const path = u.pathname;

    // 1) explicit ?seed=
    const qpSeed = u.searchParams.get("seed");
    if (qpSeed && qpSeed.length) return decodeURIComponent(qpSeed);

    // 2) picsum: /seed/<seed>/<w>/<h>
    if (host.includes("picsum.photos")) {
      const parts = path.split("/").filter(Boolean);
      const seedIdx = parts.indexOf("seed");
      if (seedIdx >= 0 && parts.length > seedIdx + 1) {
        return decodeURIComponent(parts[seedIdx + 1]);
      }
      return src;
    }

    // 3) unsplash: /photo-<id>
    if (host.includes("images.unsplash.com")) {
      const id = extractUnsplashIdFromPath(path);
      if (id) return id;
      return src;
    }

    // 4) dummyimage / placehold: fallback to text=
    if (host.includes("dummyimage.com") || host.includes("placehold.co")) {
      const text = u.searchParams.get("text");
      if (text) return decodeURIComponent(text);
      return src;
    }

    // 5) otherwise keep the full src to keep stability
    return src;
  } catch {
    return src || undefined;
  }
}

/**
 * Single source of truth: build a provider-based demo image URL.
 * IMPORTANT: same (non-empty) `seed` MUST produce visually the same image across sizes.
 */
export function buildDemoImageUrl(
  w: number,
  h: number,
  seed?: string,
  label = "Demo"
): string {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  const s = seed && seed.length ? seed : `${label}-${W}x${H}`;
  const safeSeed = encodeURIComponent(s);

  switch (DEMO_IMAGE_PROVIDER as DemoImageProvider) {
    case "data":
      return svgDataUrl(W, H, label);

    case "picsum":
      // https://picsum.photos/seed/<seed>/<w>/<h>
      return `https://picsum.photos/seed/${safeSeed}/${W}/${H}`;

    case "unsplash": {
      // If seed *looks* like a real Unsplash id, use it; otherwise pick from curated pool.
      const id = looksLikeRealUnsplashId(s)
        ? s
        : UNSPLASH_IDS[hashSeed(s) % UNSPLASH_IDS.length];
      // crop=entropy keeps framing consistent; q=80 is a good balance.
      return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&crop=entropy&w=${W}&h=${H}&q=80`;
    }

    case "placehold": {
      const { bg, fg } = colorFromSeed(s);
      // include &seed so we can reconstruct the same visual later
      return `https://placehold.co/${W}x${H}/${bg}/${fg}?text=${encodeURIComponent(
        label
      )}&font=roboto&seed=${safeSeed}`;
    }

    case "dummyimage":
    default: {
      const { bg, fg } = colorFromSeed(s);
      // include &seed so we can reconstruct the same visual later
      return `https://dummyimage.com/${W}x${H}/${bg}/${fg}&text=${encodeURIComponent(
        label
      )}&seed=${safeSeed}`;
    }
  }
}

/** Convenience: get a hi-res variant using the SAME seed as `src`. */
export function getHiResVariant(
  src: string | undefined | null,
  width: number,
  height: number,
  label = "Page"
): string {
  const seed = extractDemoSeed(src) || src || `${width}x${height}`;
  return buildDemoImageUrl(
    Math.max(1, Math.round(width)),
    Math.max(1, Math.round(height)),
    seed,
    label
  );
}
