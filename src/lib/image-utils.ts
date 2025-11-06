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

/**
 * Image utilities for safe URLs, host allowlisting, demo mode, and graceful fallbacks.
 */

import { DEMO_IMAGES, DEMO_IMAGE_PROVIDER, ALLOWED_IMAGE_HOSTS } from "@/config/env";
import {
  buildDemoImageUrl,
  extractDemoSeed,
  isDemoProviderUrl,
  extractUnsplashIdFromPath,
  looksLikeRealUnsplashId,
  getHiResVariant as providerHiResVariant
} from "@/lib/demo-image-provider";

/** Blur placeholder for ExpoImage (exactly 28 chars) */
export const PLACEHOLDER_BLURHASH = "LEHV6nWB2yk8pyo0adR*.7kCMdnj" as const;

// Dev-time guard & boot log
if (typeof __DEV__ !== "undefined" && __DEV__) {
  if (PLACEHOLDER_BLURHASH.length !== 28) {
    // eslint-disable-next-line no-console
    console.warn(
      `[image] PLACEHOLDER_BLURHASH length is ${PLACEHOLDER_BLURHASH.length}, expected 28`
    );
  }
  // eslint-disable-next-line no-console
  console.log("[image] DEMO_IMAGES =", DEMO_IMAGES, "provider =", DEMO_IMAGE_PROVIDER);
}

/** Stable placeholder used as ultimate fallback */
export const FALLBACK_PLACEHOLDER = (w: number, h: number, label = "No Image"): string =>
  `https://placehold.co/${Math.max(1, Math.round(w))}x${Math.max(
    1,
    Math.round(h)
  )}?text=${encodeURIComponent(label)}&font=roboto`;

/* ----------------------------------------------------------------------------
 * URL helpers
 * --------------------------------------------------------------------------*/

/** Normalize protocol-relative / relative URLs into absolute; pass through data/blob/file URLs */
export function sanitizeImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const u = url.trim();
  if (u === "") return undefined;

  // data, blob, file & asset URLs are fine
  if (
    u.startsWith("data:image/") ||
    u.startsWith("blob:") ||
    u.startsWith("file:") ||
    u.startsWith("asset:")
  ) {
    return u;
  }

  // protocol-relative (e.g. //cdn.example.com/img.jpg)
  if (u.startsWith("//")) {
    const proto = typeof window !== "undefined" ? window.location.protocol : "https:";
    return `${proto}${u}`;
  }

  // absolute URL?
  try {
    // eslint-disable-next-line no-new
    new URL(u);
    return u;
  } catch {
    // If relative and we're on web, resolve vs current origin; on native leave as-is
    if (typeof window !== "undefined") {
      try {
        return new URL(u, window.location.origin).toString();
      } catch {
        return u;
      }
    }
    return u;
  }
}

/**
 * Keep original query string by default.
 * Dropping query params can break signed/CDN URLs; only mutate for known hosts if needed.
 */
export function normalizeCoverUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  return url; // keep as-is
}

/** Host allowlist check with sensible defaults (case-insensitive) */
export function isAllowedHost(url?: string | null): boolean {
  if (!url) return false;

  // Always allow data/blob/file/asset URLs
  if (
    url.startsWith("data:image/") ||
    url.startsWith("blob:") ||
    url.startsWith("file:") ||
    url.startsWith("asset:")
  ) {
    return true;
  }

  // Parse hostname if possible
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    // If it wasn't an absolute URL, allow it — native can handle local asset paths
    return true;
  }

  // Same-origin is allowed on web
  if (typeof window !== "undefined" && host === window.location.hostname) {
    return true;
  }

  // If the list is empty, allow all hosts (opt-out behavior)
  if (!ALLOWED_IMAGE_HOSTS || ALLOWED_IMAGE_HOSTS.length === 0) return true;

  const hLower = host.toLowerCase();

  // Exact or suffix match (subdomains), case-insensitive and trimmed
  return ALLOWED_IMAGE_HOSTS.some(allowedRaw => {
    const allowed = (allowedRaw || "").toString().trim().toLowerCase();
    if (!allowed) return false;
    return hLower === allowed || hLower.endsWith(`.${allowed}`);
  });
}

/** Avoid prefetching flaky/rate-limited endpoints */
export function shouldPrefetch(url?: string | null): boolean {
  if (!url || DEMO_IMAGES) return false;
  if (!isAllowedHost(url)) return false;
  // Picsum tends to 522 under load; skip unless explicitly allowlisted
  if (/picsum\.photos/i.test(url)) return false;
  return true;
}

/* ----------------------------------------------------------------------------
 * DEMO seed preservation & hi-res upgrade
 * --------------------------------------------------------------------------*/

export { extractDemoSeed } from "@/lib/demo-image-provider";

/** Build a higher-resolution variant using the SAME seed as `src`. */
export function getHiResVariant(
  src: string | undefined | null,
  width: number,
  height: number,
  label = "Page"
): string {
  return providerHiResVariant(src, width, height, label);
}

/* ----------------------------------------------------------------------------
 * Main API
 * --------------------------------------------------------------------------*/

export function getSafeImageUrl(url?: string | null, width = 240, height = 360): string {
  // Demo mode: preserve visuals, but fix invalid Unsplash ids
  if (DEMO_IMAGES) {
    if (url && isDemoProviderUrl(url)) {
      try {
        const u = new URL(
          url,
          typeof window !== "undefined" ? window.location.origin : "https://local"
        );
        const host = u.hostname.toLowerCase();

        // If it's Unsplash, ensure photo id is real; otherwise rebuild via demo builder
        if (host.includes("images.unsplash.com")) {
          const id = extractUnsplashIdFromPath(u.pathname);
          if (looksLikeRealUnsplashId(id)) {
            return url; // valid Unsplash URL → keep as-is
          }
          // invalid id → rebuild using seed so we get a valid curated Unsplash URL
          const seed = extractDemoSeed(url) || url || undefined;
          return buildDemoImageUrl(width, height, seed, "Page");
        }

        // Other demo providers (picsum, dummyimage, placehold, data) → keep as-is
        return url;
      } catch {
        // fall through to synthesize
      }
    }
    // Not a demo URL or parsing failed → synthesize deterministically from seed
    const seed = extractDemoSeed(url) || url || undefined;
    return buildDemoImageUrl(width, height, seed, "Page");
  }

  // Non-demo mode (real images)
  const sanitized = sanitizeImageUrl(url);
  const normalized = normalizeCoverUrl(sanitized);

  if (!normalized) return FALLBACK_PLACEHOLDER(width, height);

  // Disallow non-whitelisted hosts when allowlist is configured
  if (!isAllowedHost(normalized)) {
    return FALLBACK_PLACEHOLDER(width, height, "Blocked Host");
  }

  // Conservative: avoid picsum by default (even if allowed)
  if (/picsum\.photos/i.test(normalized)) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      // eslint-disable-next-line no-console
      console.warn("[image] picsum detected; replacing with preview placeholder");
    }
    return FALLBACK_PLACEHOLDER(width, height, "Preview");
  }

  return normalized;
}
