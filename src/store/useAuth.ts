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

import { create, type StateCreator, type StoreApi, type UseBoundStore } from "zustand";

import { getAccessToken, clearSession, loginWithPassword } from "@api";

import { devtools } from "./devtools";

/** Minimal user identity info */
export type AuthUser = { id: string; email?: string } | null;

export type AuthState = {
  user: AuthUser;
  /** true once we've attempted token hydration */
  hydrated: boolean;

  /** read persisted token & infer user presence */
  hydrate: () => Promise<void>;

  /** authenticate via email + password (token persisted via @api) */
  login: (email: string, password: string) => Promise<void>;

  /** clear session & reset user */
  logout: () => Promise<void>;
};

function withTimeout<T>(p: Promise<T>, ms = 12_000, label = "Request"): Promise<T> {
  let id: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, rej) => {
    id = setTimeout(
      () => rej(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)),
      ms
    );
  });
  return Promise.race([p, timeout]).finally(() => {
    if (id) clearTimeout(id);
  }) as Promise<T>;
}

const creator: StateCreator<AuthState> = (set, get) => ({
  user: null,
  hydrated: false,

  async hydrate(): Promise<void> {
    try {
      const token = await getAccessToken();
      if (token) {
        set({ user: { id: "me" }, hydrated: true });
      } else {
        set({ user: null, hydrated: true });
      }
    } catch (e) {
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        // eslint-disable-next-line no-console
        console.warn("[auth] hydrate failed", e);
      }
      set({ user: null, hydrated: true });
    }
  },

  async login(email: string, password: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    const pwd = password.trim();
    if (!normalized || !pwd) {
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        // eslint-disable-next-line no-console
        console.warn("[auth] login skipped: empty credentials");
      }
      throw new Error("Email and password are required");
    }

    try {
      const result = await withTimeout(
        loginWithPassword({ email: normalized, password: pwd }),
        12_000,
        "Login"
      );
      if (result?.accessToken) {
        // token is persisted by @api on success
        set({ user: { id: "me", email: normalized } });
      } else {
        throw new Error("Missing access token in response");
      }
    } catch (e) {
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        // eslint-disable-next-line no-console
        console.error("[auth] login failed", e);
      }
      throw e;
    }
  },

  async logout(): Promise<void> {
    try {
      await clearSession();
    } catch (e) {
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        // eslint-disable-next-line no-console
        console.warn("[auth] logout error (ignored)", e);
      }
    } finally {
      if (get().user !== null) set({ user: null });
    }
  }
});

/**
 * Create the store and force the resulting hook to keep its exact type:
 * UseBoundStore<StoreApi<AuthState>>.
 *
 * This avoids `any` leakage from middleware (like a custom devtools wrapper),
 * which is the usual cause of the `@typescript-eslint/no-unsafe-*` errors when
 * using `useAuth(selectAuthUser)` etc.
 */
const useAuthBase = create<AuthState>()(devtools(creator, { name: "auth" }));
export const useAuth: UseBoundStore<StoreApi<AuthState>> =
  useAuthBase as unknown as UseBoundStore<StoreApi<AuthState>>;

/* -------------------- Typed selectors (for components/HOCs) -------------------- */
export const selectAuthUser = (s: AuthState): AuthUser => s.user;
export const selectAuthHydrated = (s: AuthState): boolean => s.hydrated;

/* -------------------- Back-compat aliases (keep existing imports working) -------------------- */
export const selectUser = selectAuthUser;
export const selectHydrated = selectAuthHydrated;
export const selectIsAuthenticated = (s: AuthState): boolean => Boolean(s.user);

/* -------------------- Tiny typed hooks -------------------- */
export const useAuthUser = (): AuthUser => useAuth(selectAuthUser);
export const useAuthHydrated = (): boolean => useAuth(selectAuthHydrated);

/* -------------------- Typed getter for hydrate -------------------- */
export const getAuthHydrate = (): AuthState["hydrate"] => useAuth.getState().hydrate;
