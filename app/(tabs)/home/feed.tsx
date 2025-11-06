// app/(tabs)/home/feed.tsx
import { usePathname, useRouter, type Href } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  View,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
  Platform,
  Text,
  Image as RNImage
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { StoreApi, UseBoundStore } from "zustand";

import FeatureBand from "@/components/ui/FeatureBand";
import FeedRow from "@/components/ui/FeedRow";
import { env } from "@/config/env";
import { layout, palette, fonts } from "@/config/theme";
import { getSafeImageUrl } from "@/lib/image-utils";
import { useCategories } from "@/store/useCategories";
import {
  useLibrary,
  selectLibraryItems,
  selectLibraryLoading,
  selectLibraryRefresh
} from "@/store/usePdfStore";
import type { LibraryState } from "@/store/usePdfStore";
import type { PdfItem } from "@/types/pdf";

import { useCategoryTabs } from "./_layout";

/* --------------------------- Local types --------------------------- */
type Item = Pick<PdfItem, "id" | "title" | "coverUrl" | "tags" | "category">;

/* --------------------------- Theme wiring -------------------------- */
const P = layout.pagePadX;

const COLORS = {
  bg: palette.bg,
  featureBg: palette.featureBg,
  text: palette.text,
  sub: palette.sub,
  accent: palette.accent,
  divider: palette.divider
};

const FONT_TEXT = Platform.OS === "web" ? fonts.text : "Roboto";
const FONT_TITLE = Platform.OS === "web" ? fonts.title : "PlayfairDisplay-Regular";

/* ---------------------- Typed store accessors ---------------------- */
const useLibraryTyped = useLibrary as unknown as UseBoundStore<StoreApi<LibraryState>>;

/* ------------------------ Image aspect helpers --------------------- */
const HERO_ASPECT_H = 9 / 16; // height = width * 9/16

/* ------------------------------- Screen ------------------------------- */
export default function HomeListScreen(): JSX.Element {
  const { ready } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();

  const { selectedKey } = useCategoryTabs();
  const selectedCategory = selectedKey === "latest" ? undefined : selectedKey;

  const items = useLibraryTyped(selectLibraryItems) as Item[];
  const loading = useLibraryTyped(selectLibraryLoading);
  const refresh = useLibraryTyped(selectLibraryRefresh);

  const catItems = useCategories(s => s.items);
  const catsLoading = useCategories(s => s.loading);
  const _catsError = useCategories(s => s.error);
  const fetchCatsOnce = useCategories(s => s.fetchOnce);

  const [refreshing, setRefreshing] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const listRef = useRef<FlatList<Item>>(null);
  const [cache, setCache] = useState<Record<string, Item[]>>({});

  useEffect(() => {
    (async () => {
      try {
        await fetchCatsOnce();
      } catch {}
    })().catch(() => {});
  }, [fetchCatsOnce]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (items.length === 0 && !loading) {
          await refresh({});
        }
        if (!alive) return;
        if (!cache.latest) {
          const latestItems = useLibraryTyped.getState().items as Item[];
          setCache(prev => ({ ...prev, latest: latestItems.slice(0, 24) }));
        }
      } catch {}
    })().catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    const fetchForCategory = async () => {
      if (cache[selectedKey]?.length) {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
        return;
      }
      setListLoading(true);
      try {
        await refresh({ category: selectedCategory });
        if (!alive) return;
        const latestItems = useLibraryTyped.getState().items as Item[];
        setCache(prev => ({
          ...prev,
          [selectedKey]: latestItems.slice(0, 24)
        }));
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      } catch {
      } finally {
        if (alive) setListLoading(false);
      }
    };
    fetchForCategory().catch(() => {});
    return () => {
      alive = false;
    };
  }, [selectedKey, selectedCategory, refresh, cache]);

  // Only compute content width; we no longer expose isSmallScreen to avoid the warning.
  const { contentW } = useMemo(() => {
    const cw = Math.min(layout.contentMaxW, Math.max(340, width - P * 2));
    return { contentW: cw };
  }, [width]);

  const data = useMemo(
    () => cache[selectedKey] ?? items.slice(0, 24),
    [cache, selectedKey, items]
  );

  // Prefetch the exact URLs we render in the list (best-effort)
  useEffect(() => {
    const urls = (data ?? [])
      .map(it => it.coverUrl)
      .filter((u): u is string => typeof u === "string" && u.length > 0)
      .slice(0, 20);
    urls.forEach(u => {
      RNImage.prefetch(u).catch(() => {});
    });
  }, [data]);

  // Tiny nonce so pushing the same item opens a fresh modal route every time.
  const makeNonce = () => Math.random().toString(36).slice(2, 8);

  // Open the PDF viewer as a modal — pass "from" for safe close + mock-only clicked seed
  const handleOpen = useCallback(
    (id: string, clickedUrl?: string) => {
      const from =
        Platform.OS === "web"
          ? window.location.pathname + window.location.search + window.location.hash
          : pathname || "/";

      const params: Record<string, string> = {
        id,
        from: encodeURIComponent(from),
        _k: makeNonce()
      };

      if (env.API_BASE_URL.startsWith("mock://") && clickedUrl) {
        params.clicked = encodeURIComponent(clickedUrl);
      }

      const href: Href = { pathname: "/(modals)/pdf/[id]", params };
      router.push(href);
    },
    [router, pathname]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh({ category: selectedCategory });
      const latestItems = useLibraryTyped.getState().items as Item[];
      setCache(prev => ({
        ...prev,
        [selectedKey]: latestItems.slice(0, 24)
      }));
    } finally {
      setRefreshing(false);
    }
  }, [refresh, selectedCategory, selectedKey]);

  const contentBottomPadding = Platform.OS === "ios" ? bottom + 180 : bottom + 170;

  if (!ready || (catsLoading && catItems.length === 0)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.text} />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      {listLoading && !cache[selectedKey] ? (
        <View style={styles.loading}>
          <ActivityIndicator color={COLORS.text} />
        </View>
      ) : (
        <FlatList<Item>
          style={[
            { flex: 1 },
            Platform.OS === "web"
              ? ({ overflowY: "auto" } as Record<string, unknown>)
              : {}
          ]}
          ref={listRef}
          data={data}
          keyExtractor={it => it.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: contentBottomPadding }}
          disableVirtualization={Platform.OS === "web"}
          removeClippedSubviews={false}
          initialNumToRender={Platform.OS === "web" ? 24 : 10}
          maxToRenderPerBatch={Platform.OS === "web" ? 24 : 10}
          windowSize={Platform.OS === "web" ? 7 : 9}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.text}
              colors={[COLORS.accent]}
            />
          }
          ListEmptyComponent={
            <View style={{ padding: 24, alignItems: "center" }}>
              <Text style={{ color: COLORS.sub }}>No items in this category yet.</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            if (index === 0) {
              // Feature band (landscape banner, full content width)
              const heroW = contentW;
              const heroH = Math.round(heroW * HERO_ASPECT_H);
              const heroUrl = getSafeImageUrl(item.coverUrl, heroW, heroH);

              return (
                <FeatureBand
                  item={item}
                  contentWidth={contentW}
                  onOpen={(id: string) => handleOpen(id, heroUrl)}
                  colors={{
                    featureBg: COLORS.featureBg,
                    text: COLORS.text,
                    sub: COLORS.sub
                  }}
                  fontTitle={FONT_TITLE}
                  fontText={FONT_TEXT}
                />
              );
            }

            // Feed rows — landscape image based on row width
            const rowW = width;
            const innerPad = P;
            const usableW = Math.max(120, rowW - innerPad * 2);
            const rowH = Math.round(usableW * HERO_ASPECT_H);
            const rowUrl = getSafeImageUrl(item.coverUrl, usableW, rowH);

            return (
              <View
                style={{
                  width: contentW,
                  alignSelf: "center",
                  paddingHorizontal: P,
                  minWidth: 0,
                  paddingRight: P
                }}
              >
                <View style={{ paddingVertical: Platform.OS === "web" ? 6 : 8 }}>
                  <FeedRow
                    item={item}
                    onOpen={(id: string) => handleOpen(id, rowUrl)}
                    colors={{
                      featureBg: COLORS.featureBg,
                      text: COLORS.text,
                      sub: COLORS.sub
                    }}
                    fontTitle={FONT_TITLE}
                    fontText={FONT_TEXT}
                  />
                </View>
                <View
                  style={{ height: 1, backgroundColor: COLORS.divider, opacity: 0.8 }}
                />
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

/* -------------------------------- Styles -------------------------------- */
const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.bg,
    ...(Platform.OS === "web" ? ({ minHeight: "100vh" } as Record<string, unknown>) : {})
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bg
  }
});
