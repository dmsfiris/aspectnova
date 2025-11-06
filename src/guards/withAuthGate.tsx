// src/guards/withAuthGate.tsx
import { Redirect } from "expo-router";
import React from "react";
import type { StoreApi, UseBoundStore } from "zustand";

import { useAuth } from "@/store/useAuth";
import type { AuthState, AuthUser } from "@/store/useAuth";

type WithAuthGateOptions = {
  /** Optional element to render while auth state hydrates (default: null) */
  loading?: React.ReactElement | null;
  /** Where to send unauthenticated users (default: "/login") */
  redirectTo?: string;
};

// Cast the possibly-`any` hook to a properly typed Zustand store hook
const useAuthTyped = useAuth as unknown as UseBoundStore<StoreApi<AuthState>>;

// Strongly-typed local selectors
const selectHydrated = (s: AuthState): boolean => s.hydrated;
const selectUser = (s: AuthState): AuthUser => s.user;

export function withAuthGate<P extends object>(
  Comp: React.ComponentType<P>,
  options?: WithAuthGateOptions
): React.ComponentType<P> {
  const { loading = null, redirectTo = "/login" } = options ?? {};

  function Guarded(props: P): React.ReactElement | null {
    const hydrated = useAuthTyped(selectHydrated);
    const user = useAuthTyped(selectUser);

    if (!hydrated) return loading;
    if (!user) return <Redirect href={redirectTo} />;

    return <Comp {...props} />;
  }

  Guarded.displayName = `withAuthGate(${Comp.displayName || Comp.name || "Component"})`;
  return Guarded;
}
