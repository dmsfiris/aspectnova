// src/components/ui/FeedRow.tsx
import { Link, usePathname, useRouter } from "expo-router";
import React, { memo, useCallback, useMemo } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
  type TextStyle
} from "react-native";

import { SafeImage } from "@/components/ui/SafeImage";
import { DEMO_IMAGES } from "@/config/env";
import { fonts } from "@/config/theme"; // ← moved before demo-image-provider to satisfy import/order
import { buildDemoImageUrl } from "@/lib/demo-image-provider";
import { getSafeImageUrl } from "@/lib/image-utils";

export type FeedItem = {
  id: string;
  title: string;
  coverUrl?: string | null;
};

type Props = {
  item: FeedItem;
  /** Optional: parent can handle navigation itself; if omitted, FeedRow navigates to /(modals)/pdf/[id] */
  onOpen?: (id: string, clickedUrl?: string) => void;
  colors: { featureBg: string; text: string; sub: string };
  /** Optional overrides; default to theme fonts (Roboto Condensed for titles) */
  fontTitle?: string | string[];
  fontText?: string | string[];
};

const FeedRow = memo(function FeedRow({
  item,
  onOpen,
  colors,
  fontTitle,
  fontText
}: Props) {
  const router = useRouter();
  const pathname = usePathname() || "/home";

  const { width } = useWindowDimensions();
  const isSmall = width < 500;
  const TH_W = isSmall ? 96 : 126;
  const TH_H = isSmall ? TH_W : Math.round(TH_W * 0.625);

  // Match demo thumb to page 1 image in mock mode
  const imgUri = useMemo(() => {
    if (DEMO_IMAGES && item.id) {
      const seed = `${encodeURIComponent(item.id)}-1`;
      return buildDemoImageUrl(TH_W, TH_H, seed, "Cover");
    }
    return getSafeImageUrl(item.coverUrl, TH_W, TH_H);
  }, [item.id, item.coverUrl, TH_W, TH_H]);

  // href object for Link / router.push (no random/non-deterministic bits)
  const href = useMemo(
    () => ({
      pathname: "/(modals)/pdf/[id]" as const,
      params: {
        id: item.id,
        from: encodeURIComponent(pathname),
        ...(DEMO_IMAGES && imgUri ? { clicked: encodeURIComponent(imgUri) } : {})
      }
    }),
    [item.id, pathname, imgUri]
  );

  const handlePress = useCallback(() => {
    if (onOpen) {
      onOpen(item.id, imgUri);
      return;
    }
    router.push(href);
  }, [onOpen, item.id, imgUri, router, href]);

  // Memoize web-only styles so they’re stable
  const webPressableBase = useMemo<StyleProp<ViewStyle>>(
    () =>
      Platform.OS === "web"
        ? ({ transitionDuration: "120ms" } as unknown as ViewStyle)
        : undefined,
    []
  );

  const webCursor = useMemo<StyleProp<ViewStyle>>(
    () =>
      Platform.OS === "web" ? ({ cursor: "pointer" } as unknown as ViewStyle) : undefined,
    []
  );

  const pressableStyles = useCallback(
    ({ pressed }: { pressed: boolean }): StyleProp<ViewStyle> => {
      const base: ViewStyle = { width: "100%", minWidth: 0 };
      const pressedStyle: ViewStyle | undefined = pressed ? { opacity: 0.92 } : undefined;
      return [base, webPressableBase, pressedStyle, webCursor];
    },
    [webPressableBase, webCursor]
  );

  const content = (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      style={pressableStyles}
      hitSlop={8}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          minWidth: 0,
          gap: isSmall ? 8 : 12
        }}
      >
        <View style={{ flex: 1, minWidth: 0, maxWidth: "100%" }}>
          <Text
            numberOfLines={3}
            style={[
              styles.title,
              { color: colors.text },
              {
                // Roboto Condensed first for article titles (theme)
                fontFamily: (fontTitle ??
                  (fonts.title as unknown)) as TextStyle["fontFamily"]
              },
              styles.webWrap
            ]}
          >
            {item.title}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.byline,
              { color: colors.sub },
              {
                fontFamily: (fontText ??
                  (fonts.text as unknown)) as TextStyle["fontFamily"]
              },
              styles.webWrap
            ]}
          >
            By Katie Notopoulos
          </Text>
        </View>

        <SafeImage
          style={{
            width: TH_W,
            height: TH_H,
            backgroundColor: colors.featureBg,
            marginLeft: 12,
            flexShrink: 0,
            borderRadius: 6
          }}
          source={{ uri: imgUri }}
          contentFit="cover"
          transition={120}
          recyclingKey={`${item.id}-thumb-${TH_W}x${TH_H}`}
          cachePolicy="memory-disk"
          priority="normal"
          placeholderContentFit="cover"
          allowDownscaling
        />
      </View>
    </Pressable>
  );

  // Web: wrap with <Link asChild> for proper anchor behavior
  if (Platform.OS === "web") {
    return (
      <Link href={href} asChild data-tab>
        {content}
      </Link>
    );
  }

  return content;
});

export default FeedRow;

const styles = StyleSheet.create({
  title: { fontSize: 14.5, lineHeight: 20, fontWeight: "700", maxWidth: "100%" },
  byline: { marginTop: 4, fontSize: 11, fontWeight: "400", maxWidth: "100%" },
  webWrap:
    Platform.OS === "web"
      ? ({
          // @ts-expect-error — web-only CSS properties
          whiteSpace: "normal",
          // @ts-expect-error — web-only CSS properties
          overflowWrap: "anywhere",
          // @ts-expect-error — web-only CSS properties
          wordBreak: "break-word",
          // @ts-expect-error — web-only CSS properties
          hyphens: "auto"
        } as unknown as TextStyle)
      : ({} as TextStyle)
});
