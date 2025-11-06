// src/components/ui/UniversalTabButton.tsx
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback, useEffect, useRef } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
  type PressableStateCallbackType,
  type View
} from "react-native";

function UniversalTabButtonBase({
  style,
  onPress,
  onLongPress,
  href: _href, // don’t forward to native
  ...rest
}: BottomTabBarButtonProps) {
  const innerRef = useRef<View>(null);

  // Web: center the wrapping <a>
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const id = requestAnimationFrame(() => {
      const node = innerRef.current as unknown as HTMLElement | null;
      const anchor = node?.closest?.("a") ?? null;
      if (!anchor) return;
      anchor.style.display = "flex";
      anchor.style.justifyContent = "center";
      anchor.style.alignItems = "center";
      anchor.style.width = "100%";
      anchor.style.height = "100%";
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const handlePress = useCallback<NonNullable<BottomTabBarButtonProps["onPress"]>>(
    e => {
      if (Platform.OS === "ios") {
        // Fire-and-forget without `void`
        setTimeout(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }, 0);
      }
      onPress?.(e);
    },
    [onPress]
  );

  return (
    <Pressable
      ref={innerRef}
      {...rest}
      onPress={handlePress}
      onLongPress={onLongPress}
      style={(state: PressableStateCallbackType): ViewStyle => {
        // Resolve user style (object or function) and flatten to a single object
        const userStyle: StyleProp<ViewStyle> =
          typeof style === "function"
            ? (style as (s: PressableStateCallbackType) => StyleProp<ViewStyle>)(state)
            : style;

        const userFlat = StyleSheet.flatten(userStyle) ?? {};

        const base: ViewStyle = {
          ...styles.base,
          ...(Platform.OS === "web" ? styles.webFlexCenter : null),
          ...(state.pressed ? styles.pressed : null),
          ...userFlat
        };
        return base; // plain object → satisfies no-unsafe-return
      }}
      accessibilityRole={rest.accessibilityRole}
      accessibilityState={rest.accessibilityState}
      testID={rest.testID}
      hitSlop={8}
    />
  );
}

export const UniversalTabButton = memo(UniversalTabButtonBase);

const styles = StyleSheet.create({
  base: {
    flex: 1,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center"
  },
  webFlexCenter: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center"
  },
  pressed: { opacity: 0.9 }
});
