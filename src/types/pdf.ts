// src/types/pdf.ts
import { z } from "zod";

/** Accept http(s), data:image/*, blob:, file:, asset: */
const URL_LIKE_RE = /^(https?:\/\/|data:image\/|blob:|file:|asset:)/i;

const UrlLike = z
  .string()
  .min(1)
  .transform(s => s.trim())
  .refine(v => URL_LIKE_RE.test(v), "Invalid or unsupported URL scheme");

/** Nullable/optional URL-like for cover fields */
const NullableUrlLike = UrlLike.nullable().optional();

/* ───────────────────────────────── Schemas ───────────────────────────────── */

export const SearchHitSchema = z.object({
  page: z.number().int().positive(),
  snippet: z.string().optional()
});

/**
 * Represents a compact item returned from the list endpoint.
 * Matches backend: { id, title, pages, coverUrl, category, tags, updatedAt }
 */
export const PdfItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  pages: z.number().int().positive(),
  coverUrl: NullableUrlLike,
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  updatedAt: z.string().datetime() // ISO timestamp (RFC3339)
});

/**
 * Represents a detailed single document.
 * Matches backend: { id, title, pages, category, tags, pageUrls? }
 */
export const PdfDetailSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  pages: z.number().int().positive(),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  pageUrls: z.array(UrlLike).nullable().optional()
});

export const ListResponseSchema = z.object({
  items: z.array(PdfItemSchema),
  nextCursor: z.string().optional()
});

/**
 * Signed page URL response.
 * - Always has `url`
 * - May include backend metadata (expiry, content type, dimensions, etc.)
 * - `strict(false)` keeps us forward-compatible with additional fields
 */
export const PageUrlSchema = z
  .object({
    url: UrlLike,
    expiresAt: z.string().datetime().optional(),
    contentType: z.string().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    // optional, commonly returned by signing/proxy layers:
    etag: z.string().optional(),
    cacheControl: z.string().optional()
  })
  .strict(false);

export const SearchResponseSchema = z.object({
  hits: z.array(SearchHitSchema)
});

/* ───────────────────────────────── Types ───────────────────────────────── */

export type SearchHit = z.infer<typeof SearchHitSchema>;
export type PdfItem = z.infer<typeof PdfItemSchema>;
export type PdfDetail = z.infer<typeof PdfDetailSchema>;
export type ListResponse = z.infer<typeof ListResponseSchema>;
export type PageUrlResponse = z.infer<typeof PageUrlSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
