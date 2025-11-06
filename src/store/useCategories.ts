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

import { z } from "zod";
import { create } from "zustand";

import { env } from "@/config/env";
import { api, APIError, type ApiFetchOptions } from "@api";

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */
export type CategoryItem = {
  key: string;
  label: string;
  count: number;
};

type CategoriesState = {
  items: CategoryItem[];
  loading: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  fetchOnce: () => Promise<void>;
  refresh: () => Promise<void>;
  getLabel: (key: string) => string | null;
};

/* -------------------------------------------------------------------------- */
/*                              Runtime validation                             */
/* -------------------------------------------------------------------------- */

const CategoryItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  count: z.number().int().nonnegative().default(0)
});

const CategoriesResponseSchema = z.object({
  items: z.array(CategoryItemSchema).default([])
});

/* -------------------------------------------------------------------------- */
/*                                 API Helper                                  */
/* -------------------------------------------------------------------------- */

const TRIM_TRAILING_SLASHES = /\/+$/;
const FETCH_TIMEOUT_MS = 10_000;

// de-dupe concurrent requests across the app (singleflight)
let inflight: Promise<CategoryItem[]> | null = null;

function withGetDefaults(opts?: ApiFetchOptions): ApiFetchOptions {
  return { timeoutMs: FETCH_TIMEOUT_MS, idempotentRetries: 2, ...(opts ?? {}) };
}

async function fetchCategories(): Promise<CategoryItem[]> {
  const base = env.API_BASE_URL.replace(TRIM_TRAILING_SLASHES, "");
  const path = `${base}/categories`;

  // Use our API client so we inherit auth/refresh/retry behavior if needed.
  // Pass the absolute URL as `path` — api.get() accepts absolute URLs too.
  const raw = await api.get<unknown>(path, withGetDefaults());

  const parsed = CategoriesResponseSchema.safeParse(raw);
  const items = parsed.success ? parsed.data.items : [];

  // Normalize: trim strings, canonicalize key to lowercase, ensure count
  const normalized = items.map((c, i) => {
    const key = c.key.trim().toLowerCase();
    const label = c.label.trim() || `Category ${i + 1}`;
    const count = Number.isFinite(c.count) && c.count >= 0 ? c.count : 0;
    return { key, label, count };
  });

  // Stable sort: alphabetically by label (optional, but keeps UI tidy)
  normalized.sort((a, b) => a.label.localeCompare(b.label));

  return normalized;
}

async function fetchCategoriesSingleflight(): Promise<CategoryItem[]> {
  if (!inflight) {
    inflight = (async () => {
      try {
        return await fetchCategories();
      } finally {
        inflight = null;
      }
    })();
  }
  return inflight;
}

/* -------------------------------------------------------------------------- */
/*                                   Store                                     */
/* -------------------------------------------------------------------------- */

export const useCategories = create<CategoriesState>((set, get) => ({
  items: [],
  loading: false,
  error: null,
  lastFetchedAt: null,

  /* -------------------------- Lazy load once safely -------------------------- */
  fetchOnce: async () => {
    const { items, loading, lastFetchedAt } = get();
    const CACHE_MS = 5 * 60_000; // 5 minutes
    const isFresh =
      typeof lastFetchedAt === "number" && Date.now() - lastFetchedAt < CACHE_MS;

    if (loading || (items.length > 0 && isFresh)) return;

    set({ loading: true, error: null });
    try {
      const cats = await fetchCategoriesSingleflight();
      set({ items: cats, loading: false, error: null, lastFetchedAt: Date.now() });
    } catch (e: unknown) {
      const message =
        e instanceof APIError
          ? `Failed to load categories (HTTP ${e.status})`
          : e instanceof Error
            ? e.message
            : "Failed to load categories";
      set({ loading: false, error: message });
    }
  },

  /* ----------------------------- Force reload -------------------------------- */
  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const cats = await fetchCategoriesSingleflight();
      set({ items: cats, loading: false, error: null, lastFetchedAt: Date.now() });
    } catch (e: unknown) {
      const message =
        e instanceof APIError
          ? `Failed to load categories (HTTP ${e.status})`
          : e instanceof Error
            ? e.message
            : "Failed to load categories";
      set({ loading: false, error: message });
    }
  },

  /* --------------------------- Category label helper -------------------------- */
  getLabel: (key: string) => {
    if (!key) return null;
    const k = key.trim().toLowerCase();
    const item = get().items.find(c => c.key === k);
    return item ? item.label : null;
  }
}));
