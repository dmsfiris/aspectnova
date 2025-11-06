// app/_layout.tsx

import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  useFonts
} from "@expo-google-fonts/playfair-display";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { ActivityIndicator, Platform, View } from "react-native";

import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { env } from "@/config/env";
import { AFTER_LOGIN_PATH, LOGIN_PATH } from "@/config/routes";
import QueryOverlay from "@/dev/QueryOverlay";
import { initReactQueryLifecycle } from "@/lib/react-query-lifecycle";
import { useAuthUser, useAuthHydrated, getAuthHydrate } from "@/store/useAuth";
import "@/lib/i18n";

// dev-only helper (no console to satisfy no-console)
async function maybeInstallMock(): Promise<void> {
  if (__DEV__ && env.API_BASE_URL.startsWith("mock://")) {
    try {
      const { installMock } = await import("@/mock/installMock");
      installMock();
    } catch {
      /* ignore */
    }
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false }
  }
});

export default function RootLayout(): React.ReactElement {
  // ← DO NOT add type annotations here; let TS infer from the typed selectors.
  const user = useAuthUser();
  const hydrated = useAuthHydrated();

  const pathname = usePathname() ?? "/";

  const [fontsLoaded] = useFonts({
    "Playfair Display": PlayfairDisplay_400Regular,
    "Playfair Display SemiBold": PlayfairDisplay_600SemiBold,
    "Playfair Display Bold": PlayfairDisplay_700Bold
  });

  // Hydrate once on mount using the typed getter (no 'unsafe call/assignment')
  useEffect(() => {
    const run = async () => {
      try {
        const hydrate = getAuthHydrate();
        await hydrate();
      } catch {
        /* ignore */
      }
    };
    run().catch(() => {});
  }, []);

  // Wire React Query lifecycle (typed cleanup)
  useEffect(() => {
    const cleanup = initReactQueryLifecycle();
    return typeof cleanup === "function" ? cleanup : undefined;
  }, []);

  // Install mock API if enabled
  useEffect(() => {
    const run = async () => {
      try {
        await maybeInstallMock();
      } catch {
        /* ignore */
      }
    };
    run().catch(() => {});
  }, []);

  // Control splash screen until ready
  useEffect(() => {
    const run = async () => {
      try {
        await SplashScreen.preventAutoHideAsync();
      } catch {
        /* ignore */
      }
    };
    run().catch(() => {});
  }, []);
  useEffect(() => {
    if (hydrated && fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [hydrated, fontsLoaded]);

  // ----- WEB HELPERS -----
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const stopTabLinkReload = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const a = target?.closest("a");
      if (a && a.hasAttribute("data-tab") && a.hostname === window.location.hostname) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    document.addEventListener("click", stopTabLinkReload, true);
    document.addEventListener("auxclick", stopTabLinkReload, true);
    return () => {
      document.removeEventListener("click", stopTabLinkReload, true);
      document.removeEventListener("auxclick", stopTabLinkReload, true);
    };
  }, []);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && el.closest('[aria-hidden="true"]')) {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      }
    };
    window.addEventListener("focusin", onFocusIn, true);
    return () => window.removeEventListener("focusin", onFocusIn, true);
  }, []);
  // -----------------------

  if (!hydrated || !fontsLoaded) {
    return (
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        accessibilityRole="progressbar"
        accessibilityLabel="Loading app"
      >
        <ActivityIndicator color="#333" />
      </View>
    );
  }

  // ---------- SAFE REDIRECTS ----------
  const onLoginRoute = pathname === LOGIN_PATH;
  const onAfterLogin = pathname === AFTER_LOGIN_PATH;

  if (!user && !onLoginRoute) {
    return <Redirect href={LOGIN_PATH} />;
  }
  if (user && onLoginRoute && !onAfterLogin) {
    return <Redirect href={AFTER_LOGIN_PATH} />;
  }
  // -----------------------------------

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen
            name="(modals)"
            options={{
              presentation: "modal",
              animation: "slide_from_bottom",
              headerShown: false
            }}
          />
        </Stack>
      </ErrorBoundary>
      {__DEV__ ? <QueryOverlay /> : null}
    </QueryClientProvider>
  );
}
