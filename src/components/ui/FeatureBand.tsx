// src/components/ui/FeatureBand.tsx
import { Link, usePathname, useRouter } from "expo-router";
import React, { memo, useCallback, useMemo, useId } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle
} from "react-native";

import { SafeImage } from "@/components/ui/SafeImage";
import { DEMO_IMAGES } from "@/config/env";
import { fonts } from "@/config/theme"; // ← order: theme before demo-image-provider
import { buildDemoImageUrl } from "@/lib/demo-image-provider";
import { getSafeImageUrl } from "@/lib/image-utils";

export type FeatureItem = {
  id: string;
  title: string;
  coverUrl?: string | null;
};

type Props = {
  item: FeatureItem;
  contentWidth: number;
  /** Optional: parent can handle navigation; if omitted, this component navigates to /(modals)/pdf/[id] */
  onOpen?: (id: string) => void;
  colors: { featureBg: string; text: string; sub: string };
  /** Optional overrides; default to theme fonts (Roboto Condensed for titles) */
  fontTitle?: string | string[];
  fontText?: string | string[];
};

const FeatureBand = memo(function FeatureBand({
  item,
  contentWidth,
  onOpen,
  colors,
  fontTitle,
  fontText
}: Props) {
  const router = useRouter();
  const pathname = usePathname() || "/home";

  const HERO_ASPECT = 16 / 9;
  const MAX_W = 1024;
  const innerPad = 12;

  const mediaW = Math.min(MAX_W, contentWidth - innerPad * 2);
  const mediaH = Math.round(mediaW / HERO_ASPECT);

  // Ensure hero uses the SAME seed as page 1 in mock/demo mode
  const imgUri = useMemo(() => {
    if (DEMO_IMAGES && item.id) {
      const seed = `${encodeURIComponent(item.id)}-1`; // same as mock's pageSeed(id, 1)
      return buildDemoImageUrl(mediaW, mediaH, seed, "Cover");
    }
    // non-demo or real covers → respect allowlist/normalization
    return getSafeImageUrl(item.coverUrl, mediaW, mediaH);
  }, [item.id, item.coverUrl, mediaW, mediaH]);

  // Pure, stable id to prevent route instance reuse on web
  const uid = useId();

  // Where to open on tap (when this component navigates by itself)
  const href = useMemo(
    () => ({
      pathname: "/(modals)/pdf/[id]" as const,
      params: {
        id: item.id,
        from: encodeURIComponent(pathname),
        // In demo/mock we can pass the exact hero URL so the modal shows the same visual first
        ...(DEMO_IMAGES && imgUri ? { clicked: encodeURIComponent(imgUri) } : {}),
        _k: uid
      }
    }),
    [item.id, pathname, imgUri, uid]
  );

  const handlePress = useCallback(() => {
    if (onOpen) {
      onOpen(item.id);
      return;
    }
    router.push(href);
  }, [onOpen, item.id, router, href]);

  const content = (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      style={({ pressed }) => [
        styles.pressable,
        Platform.OS === "web" ? styles.pointer : null,
        pressed ? styles.pressed : null
      ]}
      hitSlop={8}
    >
      <View style={{ paddingHorizontal: innerPad, minWidth: 0 }}>
        <SafeImage
          source={{ uri: imgUri }}
          style={{
            width: mediaW,
            height: mediaH,
            maxWidth: MAX_W,
            maxHeight: 576,
            alignSelf: "center",
            backgroundColor: colors.featureBg,
            borderRadius: 8
          }}
          contentFit="cover"
          transition={120}
          recyclingKey={`${item.id}-hero-${mediaW}x${mediaH}`}
          cachePolicy="memory-disk"
          priority="high"
          placeholderContentFit="cover"
        />

        <View style={{ paddingTop: 12, alignSelf: "flex-start" }}>
          <Text
            numberOfLines={3}
            style={[
              styles.heroTitle,
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
              styles.heroByline,
              { color: colors.sub },
              {
                fontFamily: (fontText ??
                  (fonts.text as unknown)) as TextStyle["fontFamily"]
              },
              styles.webWrap
            ]}
          >
            By The Editors
          </Text>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.featureBand, { backgroundColor: colors.featureBg }]}>
      <View style={[styles.innerWrap, { width: contentWidth }]}>
        {Platform.OS === "web" ? (
          <Link href={href} asChild data-tab>
            {content}
          </Link>
        ) : (
          content
        )}
      </View>
    </View>
  );
});

export default FeatureBand;

const styles = StyleSheet.create({
  featureBand: { width: "100%", paddingTop: 16, paddingBottom: 18, marginBottom: 10 },
  innerWrap: { alignSelf: "center", minWidth: 0, width: "100%" },
  heroTitle: { fontSize: 22, lineHeight: 28, fontWeight: "600", maxWidth: "100%" },
  heroByline: { marginTop: 4, fontSize: 12, fontWeight: "400", maxWidth: "100%" },

  // Web-only text wrapping helpers. These keys aren't in RN's TextStyle, so cast safely.
  webWrap:
    Platform.OS === "web"
      ? ({
          // @ts-expect-error – web-only CSS properties
          whiteSpace: "normal",
          // @ts-expect-error – web-only CSS properties
          overflowWrap: "anywhere",
          // @ts-expect-error – web-only CSS properties
          wordBreak: "break-word",
          // @ts-expect-error – web-only CSS properties
          hyphens: "auto"
        } as unknown as TextStyle)
      : ({} as TextStyle),

  // Web-only visual affordances
  pointer:
    Platform.OS === "web"
      ? ({
          // @ts-expect-error – web-only CSS property
          cursor: "pointer",
          // @ts-expect-error – web-only CSS property
          transitionDuration: "120ms"
        } as unknown as ViewStyle)
      : ({} as ViewStyle),

  pressable: {},
  pressed: { opacity: 0.92 }
});
