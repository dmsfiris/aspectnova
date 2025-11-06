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

import type { z } from "zod";

import {
  ListResponseSchema,
  PdfDetailSchema,
  PageUrlSchema,
  SearchResponseSchema,
  type ListResponse,
  type PdfDetail,
  type PageUrlResponse,
  type SearchResponse,
  type PdfItem
} from "@/types/pdf";
import { api, APIError, type ApiFetchOptions } from "@api";

/* --------------------------------- helpers -------------------------------- */

function isRecord(u: unknown): u is Record<string, unknown> {
  return typeof u === "object" && u !== null && !Array.isArray(u);
}

function isStringArray(u: unknown): u is string[] {
  return Array.isArray(u) && u.every(x => typeof x === "string");
}

/** Merge caller options with sensible GET defaults (can be overridden). */
function withGetDefaults(
  opts?: ApiFetchOptions,
  extra?: ApiFetchOptions
): ApiFetchOptions {
  return { idempotentRetries: 2, ...(opts ?? {}), ...(extra ?? {}) };
}

/** Build query string with only defined, non-empty values. */
function qs(
  params: Record<string, string | number | boolean | undefined | null>
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const s = typeof v === "string" ? v : String(v);
    if (s.length > 0) sp.append(k, s);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Zod-safe parse that converts shape mismatches into a uniform APIError. */
function parseOrThrow<TOut>(schema: z.ZodType<TOut>, data: unknown, url: string): TOut {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    // eslint-disable-next-line no-console
    console.error("[pdfApi] Shape validation failed for", url, {
      zod: result.error.flatten()
    });
  }
  throw new APIError("Invalid API response shape", {
    status: 200,
    url,
    data: result.error.flatten()
  });
}

/* ------------------------------------------------
 * Normalizers — make server/mock data match schema
 * ------------------------------------------------ */

function coerceId(idRaw: unknown, index: number): string {
  if (typeof idRaw === "string" && idRaw.length > 0) return idRaw;
  if (typeof idRaw === "number" || typeof idRaw === "boolean") return String(idRaw);
  return `tmp-${index}`;
}

/** Normalize a single item-like object to the PdfItem shape. */
function normalizeItemLike(raw: unknown, index: number): PdfItem {
  const r = isRecord(raw) ? raw : {};

  const id = coerceId(r.id ?? (r as { _id?: unknown })._id, index);

  let title = "Untitled";
  if (typeof r.title === "string" && r.title.length > 0) title = r.title;
  else if (typeof r.name === "string" && r.name.length > 0) title = r.name;

  const pagesRaw = r.pages ?? (r as { pageCount?: unknown }).pageCount;
  const pages =
    typeof pagesRaw === "number" && Number.isFinite(pagesRaw) && pagesRaw > 0
      ? pagesRaw
      : 1;

  let coverUrl: string | null = null;
  if (typeof r.coverUrl === "string") coverUrl = r.coverUrl;
  else if (typeof (r as { thumbnailUrl?: unknown }).thumbnailUrl === "string") {
    coverUrl = (r as { thumbnailUrl?: string }).thumbnailUrl ?? null;
  }

  let category: string | undefined;
  if (typeof r.category === "string" && r.category.length > 0) {
    category = r.category;
  }

  const tags = isStringArray(r.tags) ? r.tags : [];

  const updatedAt =
    typeof r.updatedAt === "string" && r.updatedAt.length > 0
      ? r.updatedAt
      : new Date().toISOString();

  return {
    id,
    title,
    pages,
    coverUrl,
    ...(category ? { category } : {}),
    ...(tags.length ? { tags } : {}),
    updatedAt
  };
}

/** Normalize list response that may include different field names. */
function normalizeListResponse(raw: unknown): ListResponse {
  const rr = isRecord(raw) ? raw : {};
  const itemsIn = Array.isArray(rr.items) ? rr.items : [];
  const items = itemsIn.map((it, i) => normalizeItemLike(it, i));

  const nextCursorVal = rr.nextCursor;
  const nextCursor =
    typeof nextCursorVal === "string" && nextCursorVal.length > 0
      ? nextCursorVal
      : undefined;

  return { items, ...(nextCursor ? { nextCursor } : {}) };
}

/** Normalize a detail-like response to PdfDetail. */
function normalizeDetail(raw: unknown): PdfDetail {
  const r = isRecord(raw) ? raw : {};

  const id = coerceId(r.id ?? (r as { _id?: unknown })._id, 0);

  let title = "Untitled";
  if (typeof r.title === "string" && r.title.length > 0) title = r.title;
  else if (typeof r.name === "string" && r.name.length > 0) title = r.name;

  const pagesRaw = r.pages ?? (r as { pageCount?: unknown }).pageCount;
  const pages =
    typeof pagesRaw === "number" && Number.isFinite(pagesRaw) && pagesRaw > 0
      ? pagesRaw
      : 1;

  let pageUrls: string[] | null = null;
  const rawPU = (r as { pageUrls?: unknown }).pageUrls ?? r.pageUrls;
  if (isStringArray(rawPU)) pageUrls = rawPU;

  let category: string | undefined;
  if (typeof r.category === "string" && r.category.length > 0) {
    category = r.category;
  }

  const tags = isStringArray(r.tags) ? r.tags : [];

  return {
    id,
    title,
    pages,
    pageUrls,
    ...(category ? { category } : {}),
    ...(tags.length ? { tags } : {})
  };
}

/* --------------------------- Public types (page opts) ---------------------- */

/** Optional rendering hints for signed page URLs */
export type PageUrlRequestHints = {
  w?: number; // desired pixel width (CSS px * DPR)
  h?: number; // desired pixel height
  dpr?: number; // device pixel ratio
  quality?: number; // 1..100 (backend may clamp/ignore)
};

/* --------------------------- numeric helpers ------------------------------ */

const clampInt = (n?: number, min = 1): number | undefined =>
  typeof n === "number" && Number.isFinite(n) ? Math.max(min, Math.round(n)) : undefined;

const clampQuality = (q?: number): number | undefined =>
  typeof q === "number" && Number.isFinite(q)
    ? Math.min(100, Math.max(1, Math.round(q)))
    : undefined;

/* --------------------------- type guard (no casts) ------------------------- */

function isHints(u: unknown): u is PageUrlRequestHints {
  return (
    typeof u === "object" &&
    u !== null &&
    ("w" in (u as Record<string, unknown>) ||
      "h" in (u as Record<string, unknown>) ||
      "dpr" in (u as Record<string, unknown>) ||
      "quality" in (u as Record<string, unknown>))
  );
}

/* --------------------------- Endpoint implementations ---------------------- */

export async function listPdfs(
  cursor?: string,
  q?: string,
  category?: string,
  tag?: string,
  sort?: "updatedAt_desc" | "updatedAt_asc",
  opts?: ApiFetchOptions
): Promise<ListResponse> {
  const path = `/pdfs${qs({ cursor, q, category, tag, sort })}`;
  const raw = await api.get<unknown>(path, withGetDefaults(opts));

  try {
    return parseOrThrow(ListResponseSchema, raw, path);
  } catch {
    try {
      const normalized = normalizeListResponse(raw);
      return parseOrThrow(ListResponseSchema, normalized, path);
    } catch {
      // Final tolerant coercion (very defensive)
      const rr = isRecord(raw) ? raw : {};
      const itemsIn = Array.isArray(rr.items) ? rr.items : [];
      const items: PdfItem[] = itemsIn.map((it, i) => {
        const n = normalizeItemLike(it, i);
        return {
          id: n.id || `tmp-${i}`,
          title: n.title || "Untitled",
          coverUrl: typeof n.coverUrl === "string" ? n.coverUrl : null,
          pages: n.pages > 0 ? n.pages : 1,
          updatedAt: n.updatedAt,
          ...(n.category ? { category: n.category } : {}),
          ...(Array.isArray(n.tags) && n.tags.length ? { tags: n.tags } : {})
        };
      });

      const nextCursorVal = rr.nextCursor;
      const nextCursor =
        typeof nextCursorVal === "string" && nextCursorVal.length > 0
          ? nextCursorVal
          : undefined;

      const fallback: ListResponse = { items, ...(nextCursor ? { nextCursor } : {}) };
      return parseOrThrow(ListResponseSchema, fallback, path);
    }
  }
}

export async function getPdfDetail(
  id: string,
  opts?: ApiFetchOptions
): Promise<PdfDetail> {
  const path = `/pdfs/${encodeURIComponent(id)}`;
  const raw = await api.get<unknown>(path, withGetDefaults(opts));
  try {
    return parseOrThrow(PdfDetailSchema, raw, path);
  } catch (e) {
    if (e instanceof APIError) {
      const normalized = normalizeDetail(raw);
      return parseOrThrow(PdfDetailSchema, normalized, path);
    }
    throw e;
  }
}

/**
 * Size/DPR-aware page URL minting (signed).
 *
 * Backward compatible signature:
 *   - New: getPageUrl(id, page, hints?, opts?)
 *   - Old: getPageUrl(id, page, opts?)           ← still works
 */
export async function getPageUrl(
  id: string,
  page: number,
  hintsOrOpts?: PageUrlRequestHints | ApiFetchOptions,
  maybeOpts?: ApiFetchOptions
): Promise<PageUrlResponse> {
  // Guard early for invalid pages (clearer errors)
  if (!Number.isFinite(page) || page < 1) {
    throw new APIError("Page must be an integer >= 1", {
      status: 400,
      url: `/pdfs/${encodeURIComponent(id)}/pages/${String(page)}/url`
    });
  }

  // Disambiguate args without assertions (type guard narrows correctly)
  const hints: PageUrlRequestHints | undefined = isHints(hintsOrOpts)
    ? hintsOrOpts
    : undefined;
  const fetchOpts: ApiFetchOptions | undefined = isHints(hintsOrOpts)
    ? maybeOpts
    : hintsOrOpts;

  const w = clampInt(hints?.w);
  const h = clampInt(hints?.h);
  const dpr = typeof hints?.dpr === "number" && hints.dpr > 0 ? hints.dpr : undefined;
  const q = clampQuality(hints?.quality);

  // If your backend prefers `quality` instead of `q`, swap the key below.
  const path = `/pdfs/${encodeURIComponent(id)}/pages/${encodeURIComponent(page)}/url${qs(
    {
      w,
      h,
      dpr,
      q
    }
  )}`;

  const data = await api.get<unknown>(
    path,
    withGetDefaults(fetchOpts, { idempotentRetries: 3 })
  );
  return parseOrThrow(PageUrlSchema, data, path);
}

export async function searchPdf(
  id: string,
  q: string,
  opts?: ApiFetchOptions
): Promise<SearchResponse> {
  const path = `/pdfs/${encodeURIComponent(id)}/search${qs({ q })}`;
  const data = await api.get<unknown>(path, withGetDefaults(opts));
  return parseOrThrow(SearchResponseSchema, data, path);
}
