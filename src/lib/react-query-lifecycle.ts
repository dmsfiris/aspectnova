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

import NetInfo from "@react-native-community/netinfo";
import type { NetInfoState } from "@react-native-community/netinfo";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";
import type { AppStateStatus } from "react-native";

/**
 * Wires React Query to:
 * - AppState (focusManager): pauses refetch when app is backgrounded.
 * - Network status (onlineManager): web via window events; native via NetInfo.
 */
export function initReactQueryLifecycle(): () => void {
  const cleanups: (() => void)[] = [];

  /* ----------------------- Focus (AppState) ----------------------- */
  try {
    const setFocusedFromState = (state: AppStateStatus) => {
      // RN reports "active" | "background" | "inactive" (iOS) etc.
      focusManager.setFocused(state === "active");
    };

    // Initial
    const current = AppState.currentState;
    if (current === "active" || current === "background" || current === "inactive") {
      setFocusedFromState(current);
    }

    // Subscribe
    const sub = AppState.addEventListener("change", setFocusedFromState);
    cleanups.push(() => {
      try {
        sub.remove();
      } catch {
        /* noop */
      }
    });
  } catch {
    /* noop */
  }

  /* ---------------- Online (web / native detection) --------------- */
  if (Platform.OS === "web") {
    try {
      // Initial value from navigator.onLine (defaults to true)
      const isOnline =
        typeof navigator !== "undefined" && "onLine" in navigator
          ? Boolean(navigator.onLine)
          : true;
      onlineManager.setOnline(isOnline);

      if (typeof window !== "undefined" && window.addEventListener) {
        const onOnline = () => onlineManager.setOnline(true);
        const onOffline = () => onlineManager.setOnline(false);
        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);
        cleanups.push(() => {
          window.removeEventListener("online", onOnline);
          window.removeEventListener("offline", onOffline);
        });
      }
    } catch {
      /* noop */
    }
  } else {
    // Native: use NetInfo
    try {
      const unsub = NetInfo.addEventListener((state: NetInfoState) => {
        const online =
          state?.isConnected === true && (state?.isInternetReachable ?? true) !== false;
        onlineManager.setOnline(online);
      });
      cleanups.push(() => {
        try {
          unsub();
        } catch {
          /* noop */
        }
      });

      // Best-effort initial value (promise handled; no `void`)
      NetInfo.fetch()
        .then((state: NetInfoState) => {
          const online =
            state?.isConnected === true && (state?.isInternetReachable ?? true) !== false;
          onlineManager.setOnline(online);
        })
        .catch(() => {
          /* noop */
        });
    } catch {
      // If NetInfo fails unexpectedly, assume online; React Query will still back off on failures.
      onlineManager.setOnline(true);
    }
  }

  /* ---------------------------- Cleanup --------------------------- */
  return () => {
    for (const fn of cleanups) {
      try {
        fn();
      } catch {
        /* noop */
      }
    }
  };
}
