// app/(modals)/pdf/[id].tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  PixelRatio
} from "react-native";
import type { LayoutChangeEvent } from "react-native";
import Animated, { FadeInRight, FadeOutLeft } from "react-native-reanimated";

import { ErrorView } from "@/components/ui/ErrorView";
import { SafeImage } from "@/components/ui/SafeImage";
import { env } from "@/config/env";
import { AFTER_LOGIN_PATH } from "@/config/routes";
import { mapApiError } from "@/lib/errors";
// Keep image-utils import above store imports to satisfy import/order
import { extractDemoSeed } from "@/lib/image-utils";
import { useCategories } from "@/store/useCategories";
import {
  useReader,
  selectReaderOpen,
  selectReaderResolvePageUrl,
  selectReaderCurrent,
  selectReaderLoadingDoc,
  selectReaderPage,
  selectReaderSetPage
} from "@/store/usePdfStore";

/** Extend the router instance to probe optional canGoBack (not always typed) */
type RouterWithOptionalCanGoBack = ReturnType<typeof useRouter> & {
  canGoBack?: () => boolean;
};

// Normalize any thrown value into an Error
function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  try {
    return new Error(typeof e === "string" ? e : JSON.stringify(e));
  } catch {
    return new Error(String(e));
  }
}

// Return true if two demo URLs will render the same visual (same seed)
function sameVisual(a?: string | null, b?: string | null): boolean {
  const sa = extractDemoSeed(a ?? undefined);
  const sb = extractDemoSeed(b ?? undefined);
  return !!sa && !!sb && sa === sb;
}

export default function PdfModalScreen(): React.ReactElement {
  const router = useRouter() as RouterWithOptionalCanGoBack;
  const params = useLocalSearchParams<{
    id?: string | string[];
    from?: string | string[];
    /** optional encoded URL of the clicked image (mock only) */
    clicked?: string | string[];
    /** optional nonce to force a fresh route instance */
    _k?: string | string[];
  }>();

  // Normalize params (expo-router can give string[])
  const id = useMemo(
    () => (Array.isArray(params.id) ? params.id[0] : params.id) ?? "",
    [params.id]
  );
  const from = useMemo(
    () => (Array.isArray(params.from) ? params.from[0] : params.from) ?? "",
    [params.from]
  );

  // In mock mode, we can receive an encoded "clicked" image URL to show first
  const isMock = env.API_BASE_URL.startsWith("mock://");
  const clickedRaw = useMemo(
    () => (Array.isArray(params.clicked) ? params.clicked[0] : params.clicked) ?? null,
    [params.clicked]
  );
  const clickedUrl = useMemo(() => {
    if (!clickedRaw) return null;
    try {
      return decodeURIComponent(clickedRaw);
    } catch {
      return clickedRaw;
    }
  }, [clickedRaw]);

  // Reader store via typed selectors
  const open = useReader(selectReaderOpen);
  const resolvePageUrl = useReader(selectReaderResolvePageUrl);
  const current = useReader(selectReaderCurrent);
  const loadingDoc = useReader(selectReaderLoadingDoc);
  const page = useReader(selectReaderPage);
  const setPage = useReader(selectReaderSetPage);

  // Categories
  const catItems = useCategories(s => s.items);
  const fetchCatsOnce = useCategories(s => s.fetchOnce);

  // Current image URL displayed
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  const [docError, setDocError] = useState<Error | null>(null);
  const [pageError, setPageError] = useState<Error | null>(null);

  // Window dims (fallback) + DPR
  const { width: winW, height: winH } = useWindowDimensions();
  const dpr = Math.max(1, Math.min(3, PixelRatio.get?.() ?? 1));

  // Measure the actual fullscreen canvas (prevents “load on resize” issue on web)
  const [canvasW, setCanvasW] = useState<number | null>(null);
  const [canvasH, setCanvasH] = useState<number | null>(null);
  const onCanvasLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      // Avoid thrashing: only update when meaningfully changed
      if (Math.abs((canvasW ?? 0) - width) > 1 || Math.abs((canvasH ?? 0) - height) > 1) {
        setCanvasW(width);
        setCanvasH(height);
      }
    },
    [canvasW, canvasH]
  );

  // Resolve size hints: prefer measured canvas, fallback to window
  const hintW = Math.round((canvasW ?? winW) * dpr);
  const hintH = Math.round((canvasH ?? winH) * dpr);

  // Choose fit mode: cover for mock (hero look), contain for real PDF pages
  const contentFit: "cover" | "contain" = isMock ? "cover" : "contain";

  // Web a11y: blur any focused element when modal mounts to avoid aria-hidden warning
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const el = document.activeElement as (HTMLElement & { blur?: () => void }) | null;
      el?.blur?.();
    }
  }, []);

  // Best-effort categories; store handles dedupe/cache
  useEffect(() => {
    fetchCatsOnce().catch(() => {
      /* ignore category prefetch errors */
    });
  }, [fetchCatsOnce]);

  // Open document by id and reset reader page to 1; seed with clicked image (mock)
  useEffect(() => {
    if (!id) return;

    // Defer local state resets to avoid "set-state-in-effect" lint
    const timers: number[] = [];
    timers.push(setTimeout(() => setDocError(null), 0) as unknown as number);
    timers.push(setTimeout(() => setPageError(null), 0) as unknown as number);
    timers.push(
      setTimeout(
        () => setImgUrl(isMock && clickedUrl ? clickedUrl : null),
        0
      ) as unknown as number
    );

    let cancelled = false;
    (async () => {
      try {
        await open(id);
        if (!cancelled) setPage(1); // start from page 1 on new doc
      } catch (e) {
        if (!cancelled) setDocError(toError(e));
      }
    })().catch(() => {});

    return () => {
      cancelled = true;
      for (const t of timers) clearTimeout(t);
    };
  }, [id, open, setPage, isMock, clickedUrl]);

  // Clear page error whenever page or document changes (deferred)
  useEffect(() => {
    const t = setTimeout(() => setPageError(null), 0);
    return () => clearTimeout(t);
  }, [page, current]);

  // Resolve the current page and carefully upgrade image whenever:
  // - doc/page changes
  // - measured canvas size becomes available/changes
  // - DPR changes (rare)
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!current) return;
      const w = Math.max(1, hintW);
      const h = Math.max(1, hintH);

      try {
        const fetched = await resolvePageUrl(page, {
          w,
          h,
          dpr,
          quality: 80
        });
        if (!alive || !fetched) return;

        setImgUrl(prev => {
          if (!prev) return fetched;

          if (isMock && page === 1 && clickedUrl) {
            if (sameVisual(clickedUrl, fetched)) return fetched;
            return clickedUrl;
          }

          return fetched !== prev ? fetched : prev;
        });
      } catch (e) {
        if (alive) setPageError(toError(e));
      }
    })().catch(() => {});

    return () => {
      alive = false;
    };
  }, [current, page, resolvePageUrl, isMock, clickedUrl, hintW, hintH, dpr]);

  const totalPages = current?.pages ?? 1;
  const canPrev = page > 1;
  const canNext = page < totalPages;

  // Depend on `current` so memo stays valid
  const categoryLabel = useMemo(() => {
    if (!current?.category || catItems.length === 0) return null;
    const found = catItems.find(c => c.key === current.category);
    return found?.label ?? null;
  }, [current, catItems]);

  // Close modal without reloading tabs; fall back if there's no history (e.g. deep link)
  const onBack = useCallback(
    (e?: { preventDefault?: () => void; stopPropagation?: () => void }) => {
      if (Platform.OS === "web") {
        e?.preventDefault?.();
        e?.stopPropagation?.();
      }
      if (router.canGoBack?.()) {
        router.back();
        return;
      }
      const target = (() => {
        if (!from) return AFTER_LOGIN_PATH;
        try {
          return decodeURIComponent(from);
        } catch {
          return AFTER_LOGIN_PATH;
        }
      })();
      router.replace(target);
    },
    [router, from]
  );

  const onPrev = useCallback(() => {
    if (canPrev) setPage(page - 1);
  }, [canPrev, page, setPage]);

  const onNext = useCallback(() => {
    if (canNext) setPage(page + 1);
  }, [canNext, page, setPage]);

  if (docError) {
    const { title, message } = mapApiError(docError);
    return (
      <SafeAreaView style={styles.center}>
        <ErrorView
          title={title}
          message={message}
          onRetry={async () => {
            setDocError(null);
            if (!id) return;
            try {
              await open(id);
              setPage(1);
            } catch (e) {
              setDocError(toError(e));
            }
          }}
        />
      </SafeAreaView>
    );
  }

  if (loadingDoc || !current) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  // Unique key to force expo-image to refresh when size/page/doc changes
  const recyclingKey = `${current.id}-${page}-${hintW}x${hintH}`;

  return (
    <SafeAreaView style={styles.container}>
      {/* IMAGE AREA (full-screen) */}
      <View style={styles.fullscreenCanvas} onLayout={onCanvasLayout}>
        {/* overlay: back + page count */}
        <View style={styles.overlayTopBar}>
          <Pressable
            onPress={onBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close PDF"
            style={styles.backBtnOverlay}
          >
            <Text style={styles.backBtnOverlayText}>✕</Text>
          </Pressable>
          <Text style={styles.pageCounter}>
            {page} / {totalPages}
          </Text>
        </View>

        {pageError ? (
          (() => {
            const { title, message } = mapApiError(pageError);
            return (
              <View style={styles.centerAbsolute}>
                <ErrorView
                  title={title}
                  message={message}
                  onRetry={async () => {
                    try {
                      const hi = await resolvePageUrl(page, {
                        w: Math.max(1, hintW),
                        h: Math.max(1, hintH),
                        dpr,
                        quality: 80
                      });
                      setImgUrl(prev => (hi && hi !== prev ? hi : prev));
                    } catch (e) {
                      setPageError(toError(e));
                    }
                  }}
                />
              </View>
            );
          })()
        ) : !imgUrl ? (
          <View style={styles.solidFill}>
            <ActivityIndicator />
          </View>
        ) : (
          <Animated.View
            key={page}
            entering={FadeInRight.duration(180)}
            exiting={FadeOutLeft.duration(180)}
            style={styles.imageHolder}
          >
            <SafeImage
              // Important: give explicit size & a recyclingKey so it refreshes without resize
              source={{ uri: imgUrl }}
              style={styles.imageFill}
              contentFit={contentFit}
              transition={120}
              cachePolicy="memory-disk"
              priority="high"
              allowDownscaling
              recyclingKey={recyclingKey}
            />
          </Animated.View>
        )}
      </View>

      {/* META (title + category) */}
      <View style={styles.meta}>
        <Text numberOfLines={2} style={styles.title}>
          {current.title ?? "Document"}
        </Text>
        {categoryLabel ? (
          <View
            style={styles.catPill}
            accessibilityRole="text"
            accessibilityLabel={`Category ${categoryLabel}`}
          >
            <Text style={styles.catPillText}>{categoryLabel}</Text>
          </View>
        ) : null}
      </View>

      {/* Footer controls */}
      <View style={styles.footer}>
        <Pressable
          onPress={onPrev}
          disabled={!canPrev}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canPrev }}
          style={[styles.footerBtn, !canPrev && styles.footerBtnDisabled]}
        >
          <Text style={[styles.footerBtnText, !canPrev && styles.footerBtnTextDisabled]}>
            ◀ Prev
          </Text>
        </Pressable>

        <Pressable
          onPress={onNext}
          disabled={!canNext}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canNext }}
          style={[styles.footerBtn, !canNext && styles.footerBtnDisabled]}
        >
          <Text style={[styles.footerBtnText, !canNext && styles.footerBtnTextDisabled]}>
            Next ▶
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const COLORS = {
  border: "#ddd",
  pillBg: "#0E2239",
  pillText: "#E6EDF5",
  overlayBg: "rgba(0,0,0,0.35)",
  overlayText: "#fff",
  placeholder2: "#e2e8f0"
} as const;

const font700 = "700" as const;
const font600 = "600" as const;
const smallPad = Platform.OS === "web" ? 3 : 4;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  /* full-screen canvas for image/placeholder */
  fullscreenCanvas: { flex: 1, position: "relative", backgroundColor: "#000" },
  imageHolder: { ...StyleSheet.absoluteFillObject },
  imageFill: { width: "100%", height: "100%" }, // explicit size avoids web stall

  solidFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.placeholder2,
    alignItems: "center",
    justifyContent: "center"
  },

  /* overlay top bar (back + page counter) */
  overlayTopBar: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  backBtnOverlay: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.overlayBg,
    borderRadius: 999
  },
  backBtnOverlayText: { color: COLORS.overlayText, fontSize: 16, fontWeight: font600 },
  pageCounter: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.overlayBg,
    color: COLORS.overlayText,
    borderRadius: 999,
    fontWeight: font600
  },

  center: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  centerAbsolute: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center"
  },

  /* meta under image */
  meta: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    backgroundColor: "#fff"
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: font700,
    color: "#0f172a"
  },
  catPill: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: smallPad,
    borderRadius: 999,
    backgroundColor: COLORS.pillBg
  },
  catPillText: {
    color: COLORS.pillText,
    fontSize: 11,
    fontWeight: font600,
    letterSpacing: 0.2
  },

  /* footer */
  footer: {
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#fff"
  },
  footerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#bbb"
  },
  footerBtnDisabled: { opacity: 0.5 },
  footerBtnText: { fontWeight: font600 },
  footerBtnTextDisabled: { opacity: 0.7 }
});
