// src/components/ui/TabsBar.tsx
import { LinearGradient } from "expo-linear-gradient";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  GestureResponderEvent,
  StyleProp,
  ViewStyle
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from "react-native-reanimated";

export type TabDef = { key: string; label: string };

type Props = {
  tabs: TabDef[];
  selectedKey: string;
  onSelect: (key: string) => void;
  padX?: number;
  gap?: number;
  colors: {
    bg: string;
    sub: string;
    text: string;
    accent: string;
    divider: string;
  };
};

type Layout = { x: number; width: number };

const DRAG_THRESHOLD = 6; // px – distinguish drag from click
const RIGHT_REVEAL = 26; // px – extra room after auto-scroll reveal (right only)

const TabsBar = memo(function TabsBar({
  tabs,
  selectedKey,
  onSelect,
  padX = 16,
  gap = 18,
  colors
}: Props) {
  /* ---------------------- Scroll state ---------------------- */
  const scrollRef = useRef<ScrollView>(null);
  const containerRef = useRef<View>(null);

  const lastScrollX = useRef(0);
  const hasRestored = useRef(false);

  const [containerW, setContainerW] = useState(0);
  const [contentW, setContentW] = useState(0);
  const [scrollX, setScrollX] = useState(0);

  const canScroll = contentW > containerW + 1;
  const showLeftFade = canScroll && scrollX > 2;
  const showRightFade = canScroll && scrollX < Math.max(0, contentW - containerW - 2);

  const restoreScrollPosition = useCallback(() => {
    const x = lastScrollX.current;
    if (scrollRef.current && !hasRestored.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({ x, animated: false });
          hasRestored.current = true;
        });
      });
    }
  }, []);

  const onLayoutWrap = useCallback(
    (e: LayoutChangeEvent) => {
      setContainerW(e.nativeEvent.layout.width);
      restoreScrollPosition();
    },
    [restoreScrollPosition]
  );

  const onContentSizeChange = useCallback(
    (w: number) => {
      setContentW(typeof w === "number" ? w : 0);
      restoreScrollPosition();
    },
    [restoreScrollPosition]
  );

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    setScrollX(x);
    lastScrollX.current = x;
  }, []);

  /* ---------------------- Layout + underline ---------------------- */
  const layoutsRef = useRef<Record<string, Layout>>({});
  const setTabLayout = useCallback((key: string, layout: Layout) => {
    layoutsRef.current[key] = layout;
  }, []);

  const placedOnceRef = useRef(false);
  const pendingKeyRef = useRef<string | null>(null);

  const underlineX = useSharedValue(0);
  const underlineW = useSharedValue(0);

  const underlineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: underlineX.value }],
    width: underlineW.value
  }));

  const animateToLayout = useCallback(
    (l: Layout) => {
      // Reanimated shared values are intentionally mutable.
      // eslint-disable-next-line react-hooks/immutability
      underlineX.value = withTiming(l.x, { duration: 220 });
      // eslint-disable-next-line react-hooks/immutability
      underlineW.value = withTiming(l.width, { duration: 220 });
    },
    [underlineX, underlineW]
  );

  const placeWithoutAnimation = useCallback(
    (l: Layout) => {
      // eslint-disable-next-line react-hooks/immutability
      underlineX.value = l.x;
      // eslint-disable-next-line react-hooks/immutability
      underlineW.value = l.width;
    },
    [underlineX, underlineW]
  );

  const tryMoveToKey = useCallback(
    (key: string, animate: boolean) => {
      const l = layoutsRef.current[key];
      if (!l) {
        pendingKeyRef.current = key;
        return;
      }
      pendingKeyRef.current = null;
      if (animate) animateToLayout(l);
      else placeWithoutAnimation(l);
    },
    [animateToLayout, placeWithoutAnimation]
  );

  // Make selected tab fully visible with small *right-only* cushion
  const ensureTabFullyVisible = useCallback(
    (key: string, animated = true) => {
      const l = layoutsRef.current[key];
      if (!l || !canScroll || !scrollRef.current) return;

      const currentX = lastScrollX.current;
      const leftEdge = l.x - padX;
      const rightEdge = l.x + l.width + padX;

      const viewportLeft = currentX;
      const viewportRight = currentX + containerW;

      let targetX = currentX;
      if (leftEdge < viewportLeft) {
        targetX = Math.max(0, leftEdge);
      } else if (rightEdge > viewportRight) {
        targetX = Math.min(
          rightEdge - containerW + RIGHT_REVEAL,
          Math.max(0, contentW - containerW)
        );
      }

      if (targetX !== currentX) {
        scrollRef.current.scrollTo({ x: targetX, animated });
        lastScrollX.current = targetX;
        setScrollX(targetX);
      }
    },
    [canScroll, containerW, contentW, padX]
  );

  // When selection changes, animate underline and reveal the tab
  useEffect(() => {
    tryMoveToKey(selectedKey, placedOnceRef.current);
    const id = requestAnimationFrame(() => ensureTabFullyVisible(selectedKey, true));
    return () => cancelAnimationFrame(id);
  }, [selectedKey, tabs, tryMoveToKey, ensureTabFullyVisible]);

  useEffect(() => {
    hasRestored.current = false;
    restoreScrollPosition();
  }, [tabs.length, selectedKey, restoreScrollPosition]);

  /* ---------------------- WEB: cancel anchor defaults ---------------------- */
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const root = containerRef.current as unknown as HTMLElement | null;
    if (!root) return;

    const onCaptureClick = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target || !root.contains(target)) return;
      const a = target.closest("a");
      if (a) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !root.contains(target)) return;
      if (e.key === "Enter" || e.key === " ") {
        const a = target.closest("a");
        if (a) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    document.addEventListener("click", onCaptureClick, true);
    document.addEventListener("auxclick", onCaptureClick, true);
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("click", onCaptureClick, true);
      document.removeEventListener("auxclick", onCaptureClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  /* ---------------------- WEB: mouse drag to scroll ---------------------- */
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartScroll = useRef(0);
  const dragMoved = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node) return;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // left button only
      dragMoved.current = false;
      setDragging(true);
      dragStartX.current = e.clientX;
      dragStartScroll.current = lastScrollX.current;
      e.preventDefault(); // avoid text selection
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragStartX.current;
      if (!dragMoved.current && Math.abs(dx) > DRAG_THRESHOLD) {
        dragMoved.current = true;
      }
      const nextX = Math.max(
        0,
        Math.min(dragStartScroll.current - dx, Math.max(0, contentW - containerW))
      );
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ x: nextX, animated: false });
        lastScrollX.current = nextX;
        setScrollX(nextX);
      }
    };

    const endDrag = () => setDragging(false);

    node.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", endDrag);
    node.addEventListener("mouseleave", endDrag);

    return () => {
      node.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", endDrag);
      node.removeEventListener("mouseleave", endDrag);
    };
  }, [dragging, containerW, contentW]);

  /* ---------------------- Safe Press Handler ---------------------- */
  type WebLikeEvent = { preventDefault?: () => void; stopPropagation?: () => void };
  const handlePress = useCallback(
    (key: string) => (e: GestureResponderEvent | WebLikeEvent | undefined) => {
      if (Platform.OS === "web") {
        if (dragMoved.current) {
          e?.preventDefault?.();
          e?.stopPropagation?.();
          dragMoved.current = false;
          return;
        }
        e?.preventDefault?.();
        e?.stopPropagation?.();
      }
      if (key !== selectedKey) {
        ensureTabFullyVisible(key, true); // reveal with right cushion
        onSelect(key);
      }
    },
    [onSelect, selectedKey, ensureTabFullyVisible]
  );

  /* ---------------------- Render ---------------------- */
  const webDraggingStyle: StyleProp<ViewStyle> =
    Platform.OS === "web" && dragging
      ? ({ cursor: "grabbing", userSelect: "none" } as unknown as StyleProp<ViewStyle>)
      : undefined;

  const webContentStyle: StyleProp<ViewStyle> =
    Platform.OS === "web"
      ? ({
          // @ts-expect-error web-only styles
          touchAction: "pan-x",
          // @ts-expect-error web-only styles
          WebkitOverflowScrolling: "touch",
          // @ts-expect-error web-only styles
          cursor: dragging ? "grabbing" : "grab"
        } as unknown as StyleProp<ViewStyle>)
      : undefined;

  return (
    <View
      ref={containerRef}
      onLayout={onLayoutWrap}
      style={[
        styles.wrap,
        {
          backgroundColor: colors.bg,
          borderBottomColor: colors.divider
        },
        webDraggingStyle
      ]}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          {
            paddingHorizontal: padX,
            alignItems: "flex-end"
          },
          webContentStyle
        ]}
        onContentSizeChange={onContentSizeChange}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            gap,
            position: "relative"
          }}
        >
          {tabs.map(t => {
            const active = t.key === selectedKey;
            return (
              <Pressable
                key={t.key}
                onPress={handlePress(t.key)}
                accessibilityRole="button"
                accessibilityLabel={t.label}
                accessibilityState={{ selected: active }}
                style={styles.tabBtn}
                onLayout={e => {
                  const { x, width } = e.nativeEvent.layout;
                  setTabLayout(t.key, { x, width });

                  if (active && !placedOnceRef.current) {
                    placeWithoutAnimation({ x, width });
                    placedOnceRef.current = true;
                  }
                  if (pendingKeyRef.current === t.key) {
                    pendingKeyRef.current = null;
                    animateToLayout({ x, width });
                  }
                }}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.tabText,
                    { color: active ? colors.text : colors.sub },
                    Platform.OS === "web" ? { fontFamily: "inherit" } : null
                  ]}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}

          {/* Shared animated underline */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.tabUnderline,
              { backgroundColor: colors.accent },
              underlineStyle
            ]}
          />
        </View>
      </ScrollView>

      {/* Edge fades */}
      {showLeftFade && (
        <LinearGradient
          pointerEvents="none"
          colors={[withAlpha(colors.bg, 0.96), withAlpha(colors.bg, 0)]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.fade, styles.fadeLeft]}
        />
      )}
      {showRightFade && (
        <LinearGradient
          pointerEvents="none"
          colors={[withAlpha(colors.bg, 0), withAlpha(colors.bg, 0.96)]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.fade, styles.fadeRight]}
        />
      )}
    </View>
  );
});

export default TabsBar;

/* -------------------------- helpers -------------------------- */
function withAlpha(color: string, alpha: number): string {
  if (color.startsWith("rgba(")) {
    try {
      const parts = color
        .slice(5, -1)
        .split(",")
        .map(s => s.trim());
      const [r, g, b] = parts.slice(0, 3);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    } catch {
      return color;
    }
  }
  if (color.startsWith("rgb(")) {
    const parts = color
      .slice(4, -1)
      .split(",")
      .map(s => s.trim());
    const [r, g, b] = parts;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (color.startsWith("#")) {
    const hex = color.replace("#", "");
    const full =
      hex.length === 3
        ? hex
            .split("")
            .map(c => c + c)
            .join("")
        : hex.padEnd(6, "0").slice(0, 6);
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

/* -------------------------- styles -------------------------- */
const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 6, // gap under the label before the underline
    overflow: "hidden",
    zIndex: 1
  },
  tabBtn: {
    alignItems: "center",
    minHeight: 36,
    justifyContent: "flex-end",
    paddingBottom: 6
  },
  tabText: { fontWeight: "600", fontSize: 15 },
  tabUnderline: {
    position: "absolute",
    height: 2,
    bottom: 0,
    borderRadius: 2
  },
  fade: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 36,
    zIndex: 20,
    elevation: 20
  },
  fadeLeft: { left: 0 },
  fadeRight: { right: 0 }
});
