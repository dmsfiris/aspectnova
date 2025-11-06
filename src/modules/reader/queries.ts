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

import {
  useInfiniteQuery,
  useQuery,
  keepPreviousData,
  type UseInfiniteQueryResult,
  type UseQueryResult
} from "@tanstack/react-query";

import { getPdfDetail, getPageUrl, listPdfs, searchPdf } from "@/lib/pdfApi";
import type { PdfItem, PdfDetail, SearchHit } from "@/types/pdf";

export const readerKeys = {
  all: ["reader"] as const,
  list: (query?: string, tag?: string) =>
    [...readerKeys.all, "list", { query: query ?? "", tag: tag ?? "" }] as const,
  detail: (id: string) => [...readerKeys.all, "detail", id] as const,
  pageUrl: (id: string, page: number) =>
    [...readerKeys.all, "page-url", id, page] as const,
  search: (id: string, q: string) => [...readerKeys.all, "search", id, q] as const
};

/**
 * Infinite list of PDFs with stable placeholder to avoid flashing
 * when query/tag changes. Keeps previous pages visible while new
 * data loads.
 */
export function usePdfList(opts: {
  query?: string;
  tag?: string;
}): UseInfiniteQueryResult<{ items: PdfItem[]; nextCursor?: string }, Error> {
  const { query, tag } = opts;

  return useInfiniteQuery<
    { items: PdfItem[]; nextCursor?: string },
    Error,
    { items: PdfItem[]; nextCursor?: string },
    ReturnType<typeof readerKeys.list>,
    string | undefined
  >({
    queryKey: readerKeys.list(query, tag),
    initialPageParam: undefined,
    queryFn: ({ pageParam }) => listPdfs(pageParam, query, tag),
    getNextPageParam: last => last.nextCursor,
    // Keep prior data rendered while fetching new params/pages
    placeholderData: prev => prev,
    // Conservative network policy that still feels snappy
    retry: 1,
    staleTime: 15_000, // list is fresh for 15s
    gcTime: 5 * 60_000 // garbage collect after 5m idle
  });
}

/** Fetch a single PDF detail. */
export function usePdfDetail(id?: string): UseQueryResult<PdfDetail, Error> {
  return useQuery<PdfDetail, Error>({
    queryKey: id ? readerKeys.detail(id) : ["_skip_detail"],
    enabled: !!id,
    queryFn: () => getPdfDetail(id!),
    // Avoid flashing detail panes when refetching same id
    placeholderData: keepPreviousData,
    retry: 1,
    staleTime: 30_000, // detail is fresh for 30s
    gcTime: 10 * 60_000
  });
}

/**
 * Signed/expiring page image URL.
 * Slightly higher retry helps with transient CDN hiccups.
 */
export function usePageUrl(
  id?: string,
  page?: number
): UseQueryResult<{ url: string }, Error> {
  return useQuery<{ url: string }, Error>({
    queryKey: id && page ? readerKeys.pageUrl(id, page) : ["_skip_page_url"],
    enabled: !!id && !!page,
    queryFn: () => getPageUrl(id!, page!),
    retry: 2,
    staleTime: 5_000, // short-lived; signed URLs may rotate
    gcTime: 5 * 60_000
  });
}

/** In-document search results. */
export function usePdfSearch(
  id?: string,
  q?: string
): UseQueryResult<{ hits: SearchHit[] }, Error> {
  return useQuery<{ hits: SearchHit[] }, Error>({
    queryKey: id && q ? readerKeys.search(id, q) : ["_skip_search"],
    enabled: !!id && !!q,
    queryFn: () => searchPdf(id!, q!),
    // Keep previous hits while searching new q for a smoother UX
    placeholderData: keepPreviousData,
    retry: 1,
    staleTime: 10_000,
    gcTime: 5 * 60_000
  });
}
