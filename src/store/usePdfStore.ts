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

import { create, type StoreApi } from "zustand";

import {
  listPdfs,
  getPdfDetail,
  searchPdf,
  // accepts optional size/DPR hints and returns a (possibly signed) URL object
  getPageUrl as getPageUrlApi
} from "@/lib/pdfApi";
import type {
  ListResponse,
  PdfDetail,
  PdfItem,
  SearchHit,
  PageUrlResponse
} from "@/types/pdf";

// Platform-aware devtools shim (web = no-op, native = real devtools if available)
import { devtools } from "./devtools";

/* -------------------------------------------------------------------------- */
/*                              Helpers / Guards                               */
/* -------------------------------------------------------------------------- */

export type PageUrlOpts = {
  /** Desired pixel width of the rendered image (CSS px * DPR) */
  w?: number;
  /** Desired pixel height of the rendered image (CSS px * DPR) */
  h?: number;
  /** Device pixel ratio you'd like the backend to target (e.g., 1, 2, 3) */
  dpr?: number;
  /** Optional quality hint; backends can clamp/ignore */
  quality?: number;
};

function isPageUrlResponse(u: unknown): u is PageUrlResponse {
  return (
    typeof u === "object" &&
    u !== null &&
    typeof (u as { url?: unknown }).url === "string"
  );
}

/** Strongly-typed wrapper with optional size/DPR hints. */
async function safeGetPageUrl(
  id: string,
  page: number,
  opts?: PageUrlOpts
): Promise<PageUrlResponse> {
  const resp = await getPageUrlApi(id, page, opts);
  if (!isPageUrlResponse(resp)) throw new Error("Invalid page-url response");
  return resp;
}

/** Cache entry with expiry info returned by backend signing/proxy layers. */
type PageCacheEntry = {
  url: string;
  expiresAt?: string; // ISO timestamp
};

function nowMs(): number {
  return Date.now();
}

/** Consider expired a little before the actual expiry (default 20s skew). */
function isExpired(expiresAt?: string, skewSeconds = 20): boolean {
  if (!expiresAt) return false; // no expiry info → treat as non-expiring
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return false;
  return t - skewSeconds * 1000 <= nowMs();
}

/* -------------------------------------------------------------------------- */
/*                               Library (list)                                */
/* -------------------------------------------------------------------------- */

export type LibraryState = {
  items: PdfItem[];
  nextCursor?: string;
  loading: boolean;
  hasMore: boolean;
  query: string;
  category?: string;
  tag?: string;

  refresh: (opts?: { query?: string; category?: string; tag?: string }) => Promise<void>;
  fetchNext: () => Promise<void>;
};

export const useLibrary = create<LibraryState>()(
  devtools<LibraryState>(
    (
      set: StoreApi<LibraryState>["setState"],
      get: StoreApi<LibraryState>["getState"]
    ) => ({
      items: [],
      nextCursor: undefined,
      loading: false,
      hasMore: false,
      query: "",
      category: undefined,
      tag: undefined,

      async refresh(opts) {
        const nextQuery = opts?.query ?? "";
        const nextCategory = opts?.category;
        const nextTag = opts?.tag;

        if (!get().loading) {
          set(s => ({
            ...s,
            loading: true,
            items: [],
            nextCursor: undefined,
            hasMore: false,
            query: nextQuery,
            category: nextCategory,
            tag: nextTag
          }));
        } else {
          // Already loading: keep flags but sync filters
          set(s => ({
            ...s,
            query: nextQuery,
            category: nextCategory,
            tag: nextTag
          }));
        }

        try {
          const res: ListResponse = await listPdfs(
            undefined,
            nextQuery,
            nextCategory,
            nextTag
          );
          set(s => ({
            ...s,
            items: res.items,
            nextCursor: res.nextCursor,
            hasMore: Boolean(res.nextCursor),
            loading: false,
            query: nextQuery,
            category: nextCategory,
            tag: nextTag
          }));
        } catch {
          set(s => ({ ...s, loading: false }));
          throw new Error("Failed to refresh library");
        }
      },

      async fetchNext() {
        const snap = get();
        const { nextCursor, loading, query, category, tag } = snap;
        if (loading || !nextCursor) return;

        set(s => ({ ...s, loading: true }));

        try {
          const res: ListResponse = await listPdfs(nextCursor, query, category, tag);

          set(s => {
            const merged: PdfItem[] = [...s.items, ...res.items];
            // De-dupe by id to be safe against overlapping pages
            const uniqueById: PdfItem[] = Array.from(
              new Map<string, PdfItem>(merged.map(it => [it.id, it])).values()
            );
            return {
              ...s,
              items: uniqueById,
              nextCursor: res.nextCursor,
              hasMore: Boolean(res.nextCursor),
              loading: false
            };
          });
        } catch {
          set(s => ({ ...s, loading: false }));
          throw new Error("Failed to fetch next page");
        }
      }
    }),
    { name: "LibraryStore" }
  )
);

/* -------------------------------------------------------------------------- */
/*                               Reader (detail)                               */
/* -------------------------------------------------------------------------- */

export type ReaderState = {
  current?: PdfDetail;
  page: number;
  searchHits: SearchHit[];
  loadingDoc: boolean;

  /** Per-document ephemeral cache of signed page URLs (1-based page index) */
  pageCache: Record<number, PageCacheEntry | undefined>;

  open: (id: string) => Promise<void>;
  setPage: (n: number) => void;
  search: (q: string) => Promise<void>;
  /** Fetch a (possibly signed) page image URL; accepts optional size/DPR hints. */
  resolvePageUrl: (n: number, opts?: PageUrlOpts) => Promise<string>;
};

export const useReader = create<ReaderState>()(
  devtools<ReaderState>(
    (set: StoreApi<ReaderState>["setState"], get: StoreApi<ReaderState>["getState"]) => ({
      current: undefined,
      page: 1,
      searchHits: [],
      loadingDoc: false,
      pageCache: {},

      async open(id: string) {
        const cur = get().current;

        // Always clear cache when (re)opening a doc to avoid stale signed URLs
        set(s => ({ ...s, pageCache: {} }));

        // If it's the same document, don't refetch detail—just ensure UI is in a clean state
        if (cur?.id === id) {
          set(s => ({ ...s, loadingDoc: false, searchHits: [] }));
          return;
        }

        set(s => ({ ...s, loadingDoc: true, searchHits: [], page: 1 }));

        try {
          const detail: PdfDetail = await getPdfDetail(id);
          set(s => ({
            ...s,
            current: detail,
            loadingDoc: false,
            page: 1,
            searchHits: [],
            pageCache: {} // reset cache for new doc
          }));
        } catch {
          set(s => ({ ...s, loadingDoc: false }));
          throw new Error("Failed to open document");
        }
      },

      setPage(n: number) {
        const total = get().current?.pages ?? 1;
        const clamped = Math.max(1, Math.min(n, total));
        set(s => (s.page === clamped ? { ...s } : { ...s, page: clamped }));
      },

      async search(q: string) {
        const cur = get().current;
        if (!cur) return;

        const res = await searchPdf(cur.id, q);
        set(s => ({
          ...s,
          searchHits: Array.isArray(res.hits) ? res.hits : []
        }));
      },

      async resolvePageUrl(n: number, opts?: PageUrlOpts): Promise<string> {
        const state = get();
        const cur = state.current;
        if (!cur) throw new Error("No document is open.");

        const total = cur.pages ?? 1;
        const page = Math.max(1, Math.min(n, total));
        const docId = cur.id;

        // 1) Use cache if present and not expired
        const cached = state.pageCache[page];
        if (cached && !isExpired(cached.expiresAt)) {
          return cached.url;
        }

        // 2) Fallback to any static URL the backend returned in detail.pageUrls
        if (!cached && Array.isArray(cur.pageUrls)) {
          const staticUrl = cur.pageUrls[page - 1];
          if (typeof staticUrl === "string" && staticUrl.length > 0) {
            // populate cache with non-expiring entry for quicker subsequent calls
            set(s => ({
              ...s,
              pageCache: { ...s.pageCache, [page]: { url: staticUrl } }
            }));
            return staticUrl;
          }
        }

        // 3) Fetch fresh signed URL (honor size/DPR hints if provided)
        const resp = await safeGetPageUrl(docId, page, opts);

        // Abort if the document changed while awaiting
        if (get().current?.id !== docId) {
          throw new Error("Document changed");
        }

        // 4) Update cache and keep string array for backwards compatibility
        set(s => {
          const current = s.current;
          if (!current || current.id !== docId) return s;

          const totalPages = Math.max(1, current.pages ?? 1);
          const nextPageUrls: (string | undefined)[] = Array.isArray(current.pageUrls)
            ? [...current.pageUrls]
            : Array.from({ length: totalPages }, () => undefined);
          nextPageUrls[page - 1] = resp.url;

          return {
            ...s,
            current: { ...current, pageUrls: nextPageUrls },
            pageCache: {
              ...s.pageCache,
              [page]: { url: resp.url, expiresAt: resp.expiresAt }
            }
          };
        });

        return resp.url;
      }
    }),
    { name: "ReaderStore" }
  )
);

/* ------------------------------ Selectors ------------------------------ */

// Reader selectors
export const selectReaderOpen = (s: ReaderState) => s.open;
export const selectReaderResolvePageUrl = (s: ReaderState) => s.resolvePageUrl;
export const selectReaderCurrent = (s: ReaderState) => s.current;
export const selectReaderLoadingDoc = (s: ReaderState) => s.loadingDoc;
export const selectReaderPage = (s: ReaderState) => s.page;
export const selectReaderSetPage = (s: ReaderState) => s.setPage;

// Library selectors
export const selectLibraryItems = (s: LibraryState) => s.items;
export const selectLibraryHasMore = (s: LibraryState) => s.hasMore;
export const selectLibraryNextCursor = (s: LibraryState) => s.nextCursor;
export const selectLibraryLoading = (s: LibraryState) => s.loading;
export const selectLibraryQuery = (s: LibraryState) => s.query;
export const selectLibraryFetchNext = (s: LibraryState) => s.fetchNext;
export const selectLibraryRefresh = (s: LibraryState) => s.refresh;

/* ---------- Small helpers to keep consumers fully typed ---------- */
export type PdfStoreState = LibraryState;
export const getLibraryState = (): LibraryState => useLibrary.getState();
