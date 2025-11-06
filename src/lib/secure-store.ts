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
 
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Token storage strategy:
 * - Native (iOS/Android): Expo SecureStore (encrypted at rest).
 * - Web (default): in-memory (resets on reload; safer vs XSS). Rely on HttpOnly refresh cookie.
 * - Web (opt-in): sessionStorage if WEB_PERSIST_TOKEN === "1" (via process.env).
 *
 * Cross-tab note:
 * - sessionStorage is NOT shared across tabs and does not emit storage events cross-tab.
 * - We use BroadcastChannel (when available) to mirror updates across tabs.
 */
export const ACCESS_TOKEN_KEY = "access_token_v1";

const isWeb = Platform.OS === "web";

// Read from process.env without `any`
type MaybeEnv = { env?: Record<string, string | undefined> } | undefined;
const proc =
  typeof process !== "undefined" ? (process as unknown as MaybeEnv) : undefined;
const WEB_PERSIST =
  isWeb &&
  (proc?.env?.WEB_PERSIST_TOKEN === "1" || proc?.env?.WEB_PERSIST_TOKEN === "true");

// In-memory token for web (or fallback if sessionStorage is blocked)
let inMemoryToken: string | null = null;

/** SSR/Non-DOM guard */
function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof window.document !== "undefined";
}

/** Cache SecureStore availability to avoid repeated async probes */
let secureStoreChecked = false;
let secureStoreIsAvailable = false;
async function secureStoreAvailable(): Promise<boolean> {
  if (secureStoreChecked) return secureStoreIsAvailable;
  try {
    secureStoreIsAvailable = !!(await SecureStore.isAvailableAsync());
  } catch {
    secureStoreIsAvailable = false;
  } finally {
    secureStoreChecked = true;
  }
  return secureStoreIsAvailable;
}

/** One-time migration: remove any old localStorage token to reduce XSS exposure. */
(function migrateAwayFromLocalStorage() {
  if (!isWeb || !hasWindow()) return;
  try {
    const legacy = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    if (legacy) {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  } catch {
    // ignore (private mode or disabled storage)
  }
})();

/** If session persistence is enabled, initialize memory from sessionStorage once. */
(function hydrateFromSessionStorage() {
  if (!isWeb || !hasWindow() || !WEB_PERSIST) return;
  try {
    inMemoryToken = window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    // ignore; keep null in memory
  }
})();

/** Cross-tab token sync via BroadcastChannel (web only). */
const BC_NAME = "secure-store/auth-token";
let bc: BroadcastChannel | null = null;

(function setupBroadcastChannel() {
  if (!isWeb || !hasWindow()) return;
  try {
    if (typeof window.BroadcastChannel !== "undefined") {
      bc = new BroadcastChannel(BC_NAME);
      bc.onmessage = (ev: MessageEvent) => {
        const msg = ev.data as { key: string; value: string | null } | null;
        if (!msg || msg.key !== ACCESS_TOKEN_KEY) return;
        inMemoryToken = msg.value;
        if (WEB_PERSIST) {
          try {
            if (msg.value == null) window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
            else window.sessionStorage.setItem(ACCESS_TOKEN_KEY, msg.value);
          } catch {
            // ignore storage write failures; memory still updated
          }
        }
      };
    }
  } catch {
    // ignore
  }
})();

function broadcastToken(value: string | null): void {
  try {
    bc?.postMessage({ key: ACCESS_TOKEN_KEY, value });
  } catch {
    // ignore
  }
}

export const secure = {
  /** Get string value or null */
  async getItemAsync(key: string): Promise<string | null> {
    if (isWeb) {
      if (WEB_PERSIST && hasWindow()) {
        try {
          return window.sessionStorage.getItem(key);
        } catch {
          return inMemoryToken;
        }
      }
      return inMemoryToken;
    }

    if (!(await secureStoreAvailable())) return null;

    try {
      const val = await SecureStore.getItemAsync(key);
      return val ?? null;
    } catch {
      return null;
    }
  },

  /** Set string value (null clears) */
  async setItemAsync(key: string, value: string | null): Promise<void> {
    if (isWeb) {
      if (WEB_PERSIST && hasWindow()) {
        try {
          if (value == null) window.sessionStorage.removeItem(key);
          else window.sessionStorage.setItem(key, value);
          inMemoryToken = value;
        } catch {
          inMemoryToken = value; // Fall back to memory if sessionStorage blocked
        }
      } else {
        inMemoryToken = value;
      }
      if (key === ACCESS_TOKEN_KEY) broadcastToken(value);
      return;
    }

    if (!(await secureStoreAvailable())) return;

    try {
      if (value == null) {
        await SecureStore.deleteItemAsync(key);
      } else {
        await SecureStore.setItemAsync(key, value, {
          keychainService: "freebookapp-auth",
          keychainAccessible: SecureStore.WHEN_UNLOCKED
        });
      }
    } catch {
      /* noop */
    }
  },

  /** Remove value */
  async deleteItemAsync(key: string): Promise<void> {
    if (isWeb) {
      if (WEB_PERSIST && hasWindow()) {
        try {
          window.sessionStorage.removeItem(key);
        } catch {
          /* noop */
        }
      }
      inMemoryToken = null;
      if (key === ACCESS_TOKEN_KEY) broadcastToken(null);
      return;
    }

    if (!(await secureStoreAvailable())) return;

    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      /* noop */
    }
  }
};

// Convenience wrappers specific to the access token.
export async function getAccessToken(): Promise<string | null> {
  return secure.getItemAsync(ACCESS_TOKEN_KEY);
}
export async function setAccessToken(token: string | null): Promise<void> {
  await secure.setItemAsync(ACCESS_TOKEN_KEY, token);
}
export async function clearAccessToken(): Promise<void> {
  await secure.deleteItemAsync(ACCESS_TOKEN_KEY);
}
