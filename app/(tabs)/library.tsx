// app/(tabs)/library.tsx
import { usePathname, useRouter, useFocusEffect } from "expo-router";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";

import { ErrorView } from "@/components/ui/ErrorView";
import { SafeImage } from "@/components/ui/SafeImage";
import { env } from "@/config/env";
import { mapApiError } from "@/lib/errors";
import { getSafeImageUrl, getHiResVariant } from "@/lib/image-utils";
import { getLibraryState, type PdfStoreState, useLibrary } from "@/store/usePdfStore";

/* --------------------------------- Types --------------------------------- */

type LibraryItem = {
  id: string;
  title: string;
  coverUrl?: string | null;
};

type ItemProps = {
  item: LibraryItem;
  onPress: (id: string, clickedUrl?: string) => void;
  cardWidth: number;
};

/* ------------------------------ Constants -------------------------------- */

const CARD_MARGIN_H = 8;
const CARD_V_MARGIN = 10;
const OUTER_PADDING_H = 12;
const ASPECT = 9 / 16; // 16:9 landscape

const keyExtractor = (it: LibraryItem) => it.id;

/* --------------------------- Small util hooks ---------------------------- */

type UseLib = <T>(selector: (s: PdfStoreState) => T) => T;
const useLib = useLibrary as unknown as UseLib;

function useScrollbarGutter(): number {
  const [gutter, setGutter] = useState<number>(0);
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const compute = () => {
      try {
        const iw = window.innerWidth;
        const cw = document.documentElement.clientWidth;
        const w = Math.max(0, iw - cw);
        setGutter(w || 12);
      } catch {
        setGutter(12);
      }
    };

    let raf = 0;
    const onResize = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        compute();
      });
    };

    compute();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return Platform.OS === "web" ? gutter : 0;
}

/* ------------------------------ Components ------------------------------- */

const LibraryCard = memo(function LibraryCard({ item, onPress, cardWidth }: ItemProps) {
  const coverHeight = Math.round(cardWidth * ASPECT);
  const thumbUri = getSafeImageUrl(item.coverUrl, cardWidth, coverHeight);
  const clickedHiRes =
    env.API_BASE_URL.startsWith("mock://") && item.coverUrl
      ? getHiResVariant(item.coverUrl, 1280, 720, "Page")
      : undefined;

  const webPointer =
    Platform.OS === "web"
      ? ({ cursor: "pointer" } as unknown as React.ComponentProps<typeof View>["style"])
      : undefined;

  return (
    <Pressable
      onPress={() => onPress(item.id, clickedHiRes)}
      style={[
        styles.card,
        { width: cardWidth, marginHorizontal: CARD_MARGIN_H },
        webPointer
      ]}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      hitSlop={8}
    >
      <SafeImage
        source={{ uri: thumbUri }}
        style={[styles.cover, { width: cardWidth, height: coverHeight }]}
        contentFit="cover"
        transition={120}
        recyclingKey={`${item.id}-grid`}
        cachePolicy="memory-disk"
        priority="normal"
        placeholderContentFit="cover"
        allowDownscaling
      />
      {/* titles intentionally removed */}
    </Pressable>
  );
});

const ListFooter = memo(function ListFooterComp({
  loading,
  hasItems
}: {
  loading: boolean;
  hasItems: boolean;
}) {
  if (loading && hasItems) {
    return (
      <View style={styles.footerLoading}>
        <ActivityIndicator />
      </View>
    );
  }
  return null;
});

/* --------------------------------- Screen -------------------------------- */

export default function LibraryScreen(): JSX.Element {
  const router = useRouter();
  const pathname = usePathname() || "/library";
  const { t } = useTranslation();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const gutter = useScrollbarGutter();

  const items = useLib(s => s.items);
  const loading = useLib(s => s.loading);
  const hasMore = useLib(s => s.hasMore);
  const nextCursor = useLib(s => s.nextCursor);
  const queryFromStore = useLib(s => s.query);
  const fetchNext = useLib(s => s.fetchNext);
  const refresh = useLib(s => s.refresh);

  const [q, setQ] = useState<string>(queryFromStore ?? "");
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);

  const layout = useMemo(() => {
    const paddingLeft = OUTER_PADDING_H;
    const paddingRight = OUTER_PADDING_H + (Platform.OS === "web" ? gutter : 0);
    const available = Math.max(0, winWidth - paddingLeft - paddingRight);

    const minCard = 150;
    const minColWidth = minCard + 2 * CARD_MARGIN_H;
    const numCols = Math.max(1, Math.floor(available / minColWidth));

    const colWidth = Math.floor(available / numCols);
    const cardWidth = Math.max(120, colWidth - 2 * CARD_MARGIN_H);

    const coverH = Math.round(cardWidth * ASPECT);
    const rowHeight = coverH + CARD_V_MARGIN * 2;
    return { numCols, cardWidth, rowHeight, paddingLeft, paddingRight };
  }, [winWidth, gutter]);

  const calcMinNeeded = useCallback(() => {
    const headerH = 56;
    const footerReserve = 48;
    const availableH = Math.max(0, winHeight - headerH - footerReserve);
    const visibleRows = Math.max(1, Math.ceil(availableH / layout.rowHeight));
    return layout.numCols * visibleRows;
  }, [winHeight, layout.rowHeight, layout.numCols]);

  const fillViewportIfNeeded = useCallback(async () => {
    const minNeeded = calcMinNeeded();
    let safety = 8;
    while (
      getLibraryState().items.length < minNeeded &&
      getLibraryState().hasMore &&
      safety > 0
    ) {
      // eslint-disable-next-line no-await-in-loop
      await getLibraryState().fetchNext();
      safety -= 1;
    }
  }, [calcMinNeeded]);

  // Initial mount: load ALL (no category) respecting current query q
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await refresh({ query: q, category: undefined, tag: undefined });
        if (!cancelled) await fillViewportIfNeeded();
      } catch (e) {
        if (!cancelled) setError(e);
      }
    };
    run().catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ensure Library always shows ALL items when tab is focused (clears category/tag)
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          resetEndGuard();
          await refresh({ query: q, category: undefined, tag: undefined });
          if (alive) await fillViewportIfNeeded();
        } catch (e) {
          if (alive) setError(e);
        }
      })().catch(() => {});
      return () => {
        alive = false;
      };
    }, [q, refresh, fillViewportIfNeeded])
  );

  // Top-up after width/height/layout changes or after loading finishes
  useEffect(() => {
    if (loading) return;
    const doTopUp = async () => {
      try {
        await fillViewportIfNeeded();
      } catch (e) {
        setError(e);
      }
    };
    doTopUp().catch(() => {});
  }, [items.length, loading, fillViewportIfNeeded]);

  const endGuardRef = useRef<{ len: number; cursor?: string; ts: number }>({
    len: 0,
    cursor: undefined,
    ts: 0
  });
  const resetEndGuard = () => {
    endGuardRef.current = { len: 0, cursor: undefined, ts: 0 };
  };

  const onEndReached = useCallback(() => {
    if (loading || !hasMore) return;
    const now = Date.now();
    const debounceOk = now - endGuardRef.current.ts > 250;
    const changed =
      endGuardRef.current.len !== items.length ||
      endGuardRef.current.cursor !== nextCursor;
    if (!debounceOk || !changed) return;
    endGuardRef.current = { len: items.length, cursor: nextCursor, ts: now };
    fetchNext().catch(setError);
  }, [items.length, nextCursor, loading, hasMore, fetchNext]);

  const onSearch = useCallback(async () => {
    try {
      setError(null);
      resetEndGuard();
      // Search should also list ALL (no category) with the query
      await refresh({ query: q, category: undefined, tag: undefined });
      await fillViewportIfNeeded();
    } catch (e) {
      setError(e);
    }
  }, [q, refresh, fillViewportIfNeeded]);

  const onPressItem = useCallback(
    (id: string, clickedUrl?: string) => {
      const params: Record<string, string> = { id, from: encodeURIComponent(pathname) };
      if (env.API_BASE_URL.startsWith("mock://") && clickedUrl) {
        params.clicked = encodeURIComponent(clickedUrl);
      }
      router.push({ pathname: "/(modals)/pdf/[id]", params });
    },
    [router, pathname]
  );

  const renderItem = useCallback(
    ({ item }: { item: LibraryItem }) => (
      <LibraryCard item={item} onPress={onPressItem} cardWidth={layout.cardWidth} />
    ),
    [onPressItem, layout.cardWidth]
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<LibraryItem> | null | undefined, index: number) => {
      const row = Math.floor(index / layout.numCols);
      return { length: layout.rowHeight, offset: layout.rowHeight * row, index };
    },
    [layout.numCols, layout.rowHeight]
  );

  const FooterEl = useMemo(
    () => <ListFooter loading={loading} hasItems={items.length > 0} />,
    [loading, items.length]
  );

  const Separator = useMemo(
    () =>
      function Sep() {
        return <View style={{ height: CARD_V_MARGIN * 2 }} />;
      },
    []
  );

  if (error) {
    const { title, message } = mapApiError(error);
    return (
      <View style={styles.center}>
        <ErrorView
          title={title}
          message={message}
          onRetry={() => {
            setError(null);
            resetEndGuard();
            return refresh({ query: q, category: undefined, tag: undefined })
              .then(fillViewportIfNeeded)
              .catch(setError);
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search header */}
      <View style={styles.searchRow}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={t("library.searchPlaceholder") ?? "Search titles…"}
          style={styles.searchInput}
          returnKeyType="search"
          onSubmitEditing={onSearch}
          clearButtonMode="while-editing"
        />
        <Pressable onPress={onSearch} style={styles.searchBtn} hitSlop={6}>
          <Text style={styles.searchBtnText}>{t("common.search") ?? "Search"}</Text>
        </Pressable>
      </View>

      <FlatList<LibraryItem>
        data={items}
        key={`grid-${layout.numCols}`}
        keyExtractor={keyExtractor}
        numColumns={layout.numCols}
        columnWrapperStyle={layout.numCols > 1 ? styles.column : undefined}
        ItemSeparatorComponent={layout.numCols === 1 ? Separator : undefined}
        contentContainerStyle={[
          styles.listContent,
          { paddingLeft: layout.paddingLeft, paddingRight: layout.paddingRight }
        ]}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setError(null);
              setRefreshing(true);
              try {
                resetEndGuard();
                // Pull-to-refresh should also clear filters
                await refresh({ query: q, category: undefined, tag: undefined });
                await fillViewportIfNeeded();
              } finally {
                setRefreshing(false);
              }
            }}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {t("library.empty") ?? "No books yet."}
              </Text>
            </View>
          )
        }
        ListFooterComponent={FooterEl}
        removeClippedSubviews
        initialNumToRender={layout.numCols * 4}
        maxToRenderPerBatch={layout.numCols * 4}
        updateCellsBatchingPeriod={30}
        windowSize={9}
        getItemLayout={getItemLayout}
        onEndReachedThreshold={0.5}
        onEndReached={onEndReached}
        scrollEventThrottle={16}
      />
    </View>
  );
}

/* --------------------------------- Styles -------------------------------- */

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", padding: 24 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: OUTER_PADDING_H,
    paddingVertical: 10
  },
  searchInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ccc",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8
  },
  searchBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#111",
    borderRadius: 10
  },
  searchBtnText: { color: "#fff", fontWeight: "600" },
  listContent: { paddingBottom: 16 },
  column: { justifyContent: "flex-start" },
  card: { marginVertical: CARD_V_MARGIN, alignItems: "flex-start" },
  cover: { borderRadius: 8, backgroundColor: "#eee" },
  empty: { padding: 24, alignItems: "center" },
  emptyText: { opacity: 0.8 },
  footerLoading: { paddingVertical: 16, alignItems: "center" }
});
