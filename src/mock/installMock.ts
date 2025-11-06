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
 * Minimal mock for auth + pdf endpoints so the app can run without a backend.
 * Activate by setting: API_BASE_URL=mock://local in your .env
 *
 * Intercepts fetch calls where the final URL starts with `mock://`.
 * Handles:
 *   POST /auth/login     → { accessToken }
 *   POST /auth/refresh   → { accessToken } (if session is active)
 *   POST /auth/logout    → 204
 *   GET  /protected      → { ok: true, userId: "me" } if authorized
 *
 *   GET  /categories     → { items: Array<{ key, label, count }> }
 *   GET  /pdfs?cursor=&q=&category=&tag=&sort=updatedAt_desc
 *       → { items: PdfItem[], nextCursor?: string }
 *   GET  /pdfs/:id                → PdfDetail (includes `category`)
 *   GET  /pdfs/:id/pages/:n/url   → { url, expiresAt?, width?, height? }
 *   GET  /pdfs/:id/search?q=      → { hits: [] }
 */

import { env, DEMO_IMAGE_PROVIDER } from "@/config/env";
import { buildDemoImageUrl } from "@/lib/demo-image-provider";

// ---------- Install guard (avoid double wrapping fetch) ----------
let INSTALLED = false;

// ---------- Auth session ----------
type MockSession = {
  active: boolean;
  accessToken: string | null;
};
const session: MockSession = { active: false, accessToken: null };

// Keep a strongly typed reference to the original fetch
const ORIGINAL_FETCH: typeof fetch = globalThis.fetch.bind(globalThis);

// ---------- Helpers ----------
function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init
  });
}
function textResponse(body: string, init?: ResponseInit): Response {
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
    ...init
  });
}
function unauthorized(message = "Unauthorized"): Response {
  return jsonResponse({ error: message }, { status: 401 });
}
function notFound(): Response {
  return textResponse("Not found", { status: 404 });
}

function parseUrl(input: RequestInfo | URL): URL {
  // Avoid String(input); handle known shapes explicitly
  if (typeof input === "string") {
    try {
      return new URL(input);
    } catch {
      return new URL(input, "https://invalid.local");
    }
  }
  if (input instanceof URL) return input;

  if (typeof Request !== "undefined" && input instanceof Request) {
    try {
      return new URL(input.url);
    } catch {
      return new URL(input.url, "https://invalid.local");
    }
  }
  return new URL("https://invalid.local");
}

function readJSONBody<T = unknown>(init?: RequestInit): T | null {
  if (!init?.body) return null;
  try {
    if (typeof init.body === "string") return JSON.parse(init.body) as T;
    if (init.body instanceof FormData) {
      const obj: Record<string, unknown> = {};
      init.body.forEach((v, k) => {
        obj[k] = v;
      });
      return obj as T;
    }
    return null;
  } catch {
    return null;
  }
}
function makeAccessToken(): string {
  return `mock-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/** Normalize Authorization header from different HeadersInit shapes */
function getAuthHeader(init?: RequestInit): string | null {
  const h = init?.headers;
  if (!h) return null;

  const isHeaders = typeof Headers !== "undefined" && h instanceof Headers;
  if (isHeaders) return h.get("Authorization");

  if (Array.isArray(h)) {
    const found = h.find(([k]) => k.toLowerCase() === "authorization");
    return found ? found[1] : null;
  }

  if (typeof h === "object") {
    for (const [k, v] of Object.entries(h as Record<string, unknown>)) {
      if (k.toLowerCase() === "authorization" && typeof v === "string") {
        return v;
      }
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*                                Categories                                  */
/* -------------------------------------------------------------------------- */

type Category = { key: string; label: string };

const CATEGORY_DEFS: Category[] = [
  { key: "developer-skills", label: "Developer Skills" },
  { key: "web-development", label: "Web Development" },
  { key: "3d-virtual-spaces", label: "3D Virtual Spaces" },
  { key: "ai", label: "Artificial Intelligence" },
  { key: "digital-marketing", label: "Digital Marketing" },
  { key: "e-commerce", label: "E-Commerce" },
  { key: "entertainment-media", label: "Entertainment & Media" },
  { key: "tips-guidelines", label: "Tips and Guidelines" },
  { key: "technical-guides", label: "Technical Guides" },
  { key: "technical-solutions", label: "Technical Solutions" },
  { key: "technology-trends", label: "Technology Trends" }
];

/* -------------------------------------------------------------------------- */
/*                                 Mock PDFs                                  */
/* -------------------------------------------------------------------------- */

type MockPdf = {
  id: string;
  title: string;
  coverUrl: string; // matches page 1 image
  pages: number; // >= 1
  category: string;
  tags: string[];
  updatedAt: string; // ISO string
  pageUrls?: string[] | null;
};

// Default sizes; the URL endpoint will accept ?w=&h= to override per request
const DEFAULT_PAGE = { w: 1280, h: 720 }; // hi-res landscape for modal
const DEFAULT_THUMB = { w: 640, h: 360 }; // grid thumbnails

const pageSeed = (id: string, n: number) => `${encodeURIComponent(id)}-${n}`;

// Shared page builder (full-size landscape by default; overridden by query in handler)
const buildPageUrl = (id: string, n: number, w = DEFAULT_PAGE.w, h = DEFAULT_PAGE.h) =>
  buildDemoImageUrl(w, h, pageSeed(id, n), "Page");

// Cover uses the SAME seed & label as page 1 (identical visual), just smaller
const coverUrlFor = (id: string) =>
  buildDemoImageUrl(DEFAULT_THUMB.w, DEFAULT_THUMB.h, pageSeed(id, 1), "Page");

function isoNowMinus({
  days = 0,
  hours = 0,
  minutes = 0
}: {
  days?: number;
  hours?: number;
  minutes?: number;
}): string {
  const ms = Date.now() - (days * 86_400_000 + hours * 3_600_000 + minutes * 60_000);
  return new Date(ms).toISOString();
}

function assignCategory(i: number): string {
  const keys = CATEGORY_DEFS.map(c => c.key);
  return keys[i % keys.length];
}
function assignTags(i: number): string[] {
  const base = i % 2 === 0 ? "fiction" : "non-fiction";
  const extra = i % 3 === 0 ? ["design"] : i % 3 === 1 ? ["cs"] : ["ux"];
  return [base, ...extra];
}

const BASE_PDFS: MockPdf[] = Array.from({ length: 35 }).map((_, i) => {
  const id = `pdf-${i + 1}`;
  const pages = Math.max(1, 10 + ((i * 7) % 25));
  const updatedAt = isoNowMinus({ days: i });
  return {
    id,
    title: `Sample Book #${i + 1}`,
    coverUrl: coverUrlFor(id),
    pages,
    category: assignCategory(i),
    tags: assignTags(i),
    updatedAt,
    pageUrls: null
  };
});

const RECENT_PDFS: MockPdf[] = [
  {
    id: "recent-typography",
    title: "Practical Typography",
    coverUrl: coverUrlFor("recent-typography"),
    pages: 128,
    category: "tips-guidelines",
    tags: ["design", "non-fiction"],
    updatedAt: isoNowMinus({ minutes: 12 }),
    pageUrls: null
  },
  {
    id: "recent-algorithms",
    title: "Algorithms Illustrated",
    coverUrl: coverUrlFor("recent-algorithms"),
    pages: 220,
    category: "technical-guides",
    tags: ["cs", "non-fiction", "developer-skills"],
    updatedAt: isoNowMinus({ hours: 1, minutes: 5 }),
    pageUrls: null
  },
  {
    id: "recent-mystery",
    title: "The Midnight Staircase",
    coverUrl: coverUrlFor("recent-mystery"),
    pages: 312,
    category: "entertainment-media",
    tags: ["fiction", "technology-trends"],
    updatedAt: isoNowMinus({ hours: 3 }),
    pageUrls: null
  },
  {
    id: "recent-cookbook",
    title: "Weeknight Suppers",
    coverUrl: coverUrlFor("recent-cookbook"),
    pages: 96,
    category: "tips-guidelines",
    tags: ["non-fiction"],
    updatedAt: isoNowMinus({ hours: 7, minutes: 30 }),
    pageUrls: null
  },
  {
    id: "recent-sci-fi",
    title: "Signals From Andromeda",
    coverUrl: coverUrlFor("recent-sci-fi"),
    pages: 260,
    category: "ai",
    tags: ["fiction", "technology-trends"],
    updatedAt: isoNowMinus({ hours: 15 }),
    pageUrls: null
  },
  {
    id: "recent-essays",
    title: "Short Essays On Focus",
    coverUrl: coverUrlFor("recent-essays"),
    pages: 140,
    category: "technical-solutions",
    tags: ["non-fiction"],
    updatedAt: isoNowMinus({ days: 1, minutes: 10 }),
    pageUrls: null
  }
];

const ALL_PDFS: MockPdf[] = [...RECENT_PDFS, ...BASE_PDFS];

/* -------------------------------------------------------------------------- */
/*                           Filters & pagination                              */
/* -------------------------------------------------------------------------- */

function matchesQuery(b: MockPdf, q?: string | null): boolean {
  if (!q) return true;
  return b.title.toLowerCase().includes(q.toLowerCase());
}
function matchesCategory(b: MockPdf, category?: string | null): boolean {
  if (!category) return true;
  return b.category === category;
}
function matchesTag(b: MockPdf, tag?: string | null): boolean {
  if (!tag) return true;
  return (b.tags ?? []).includes(tag);
}
function paginate<T>(
  arr: T[],
  cursor?: string | null,
  pageSize = 12
): {
  items: T[];
  nextCursor?: string;
} {
  const start = cursor ? parseInt(cursor, 10) || 0 : 0;
  const items = arr.slice(start, start + pageSize);
  const next = start + pageSize < arr.length ? String(start + pageSize) : undefined;
  return { items, nextCursor: next };
}

/* -------------------------------------------------------------------------- */
/*                                 Installer                                   */
/* -------------------------------------------------------------------------- */

export function installMock(): void {
  if (INSTALLED) return;
  if (!env.API_BASE_URL?.startsWith("mock://")) return;

  INSTALLED = true;

  // eslint-disable-next-line no-console
  console.log(
    `[mock] Installing mock API for ${env.API_BASE_URL} (images: ${DEMO_IMAGE_PROVIDER})`
  );

  globalThis.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const url = parseUrl(input);

    // Forward non-mock requests to the original
    if (!url.href.startsWith("mock://")) {
      return ORIGINAL_FETCH(input, init);
    }

    const path = url.pathname.replace(/\/+$/, "");
    const method = (init?.method ?? "GET").toUpperCase();
    const authHeader = getAuthHeader(init);

    // ---------------- AUTH ----------------
    if (method === "POST" && path === "/auth/login") {
      const body = readJSONBody<{ email?: string; password?: string }>(init);
      if (!body?.email || !body?.password) {
        return jsonResponse({ error: "Missing credentials" }, { status: 400 });
      }
      session.active = true;
      session.accessToken = makeAccessToken();
      await new Promise(r => setTimeout(r, 120));
      return jsonResponse({ accessToken: session.accessToken });
    }

    if (method === "POST" && path === "/auth/refresh") {
      if (!session.active) return unauthorized();
      session.accessToken = makeAccessToken();
      await new Promise(r => setTimeout(r, 100));
      return jsonResponse({ accessToken: session.accessToken });
    }

    if (method === "POST" && path === "/auth/logout") {
      session.active = false;
      session.accessToken = null;
      return new Response(null, { status: 204 });
    }

    if (method === "GET" && path === "/protected") {
      const bearer = typeof authHeader === "string" ? authHeader : "";
      const hasBearer =
        bearer.startsWith("Bearer mock-") && session.active && session.accessToken;
      if (!hasBearer) return unauthorized();
      return jsonResponse({ ok: true, userId: "me" });
    }

    // ---------------- CATEGORIES ----------------
    if (method === "GET" && path === "/categories") {
      const counts = new Map<string, number>();
      for (const { key } of CATEGORY_DEFS) counts.set(key, 0);
      for (const b of ALL_PDFS) {
        if (counts.has(b.category))
          counts.set(b.category, (counts.get(b.category) || 0) + 1);
      }
      const items = CATEGORY_DEFS.map(c => ({
        key: c.key,
        label: c.label,
        count: counts.get(c.key) || 0
      }));
      return jsonResponse({ items });
    }

    // ---------------- PDFS ----------------
    if (method === "GET" && path === "/pdfs") {
      const q = url.searchParams.get("q");
      const category = url.searchParams.get("category");
      const tag = url.searchParams.get("tag");
      const cursor = url.searchParams.get("cursor");
      const sort = url.searchParams.get("sort") ?? "updatedAt_desc";

      const filtered = ALL_PDFS.filter(
        b => matchesQuery(b, q) && matchesCategory(b, category) && matchesTag(b, tag)
      );

      const sorted = [...filtered].sort((a, b) => {
        if (sort === "updatedAt_asc") return a.updatedAt.localeCompare(b.updatedAt);
        return b.updatedAt.localeCompare(a.updatedAt);
      });

      const { items, nextCursor } = paginate(sorted, cursor, 12);

      return jsonResponse({
        items: items.map(b => ({
          id: b.id,
          title: b.title,
          pages: b.pages,
          coverUrl: b.coverUrl, // matches page 1 seed via provider
          category: b.category,
          tags: b.tags,
          updatedAt: b.updatedAt
        })),
        ...(typeof nextCursor === "string" ? { nextCursor } : {})
      });
    }

    // GET /pdfs/:id
    const detailMatch = path.match(/^\/pdfs\/([^/]+)$/);
    if (method === "GET" && detailMatch) {
      const id = decodeURIComponent(detailMatch[1]);
      const b = ALL_PDFS.find(x => x.id === id);
      if (!b) return notFound();

      return jsonResponse({
        id: b.id,
        title: b.title,
        pages: Math.max(1, b.pages),
        category: b.category,
        tags: b.tags,
        pageUrls: b.pageUrls ?? null
      });
    }

    // GET /pdfs/:id/pages/:n/url  (supports size hints: ?w=&h=)
    const pageUrlMatch = path.match(/^\/pdfs\/([^/]+)\/pages\/(\d+)\/url$/);
    if (method === "GET" && pageUrlMatch) {
      const id = decodeURIComponent(pageUrlMatch[1]);
      const n = parseInt(pageUrlMatch[2], 10) || 1;
      const b = ALL_PDFS.find(x => x.id === id);
      if (!b) return notFound();
      if (n < 1 || n > Math.max(1, b.pages)) {
        return jsonResponse({ error: "Page out of range" }, { status: 400 });
      }

      // Read optional size hints (fallback to sensible defaults)
      const w = Math.max(
        1,
        Math.round(Number(url.searchParams.get("w")) || DEFAULT_PAGE.w)
      );
      const h = Math.max(
        1,
        Math.round(Number(url.searchParams.get("h")) || DEFAULT_PAGE.h)
      );

      const finalUrl = buildPageUrl(id, n, w, h);

      // Add realistic signed URL metadata
      const expiresAt = new Date(Date.now() + 60_000).toISOString(); // +60s
      return jsonResponse({
        url: finalUrl,
        expiresAt,
        width: w,
        height: h
      });
    }

    // GET /pdfs/:id/search?q=
    const searchMatch = path.match(/^\/pdfs\/([^/]+)\/search$/);
    if (method === "GET" && searchMatch) {
      const id = decodeURIComponent(searchMatch[1]);
      const q = url.searchParams.get("q") ?? "";
      const b = ALL_PDFS.find(x => x.id === id);
      if (!b) return notFound();

      const hits =
        q.trim().length === 0
          ? []
          : Array.from({ length: Math.min(5, Math.max(1, b.pages)) }).map((_, i) => ({
              page: Math.min(b.pages, (i + 1) * 2),
              snippet: `“…${q}…”`
            }));

      return jsonResponse({ hits });
    }

    return notFound();
  };

  // eslint-disable-next-line no-console
  console.log(`[mock] Installed mock API (${env.API_BASE_URL})`);
}

// Auto-install on module import
installMock();
