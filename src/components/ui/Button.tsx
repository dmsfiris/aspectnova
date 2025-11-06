// src/components/ui/Button.tsx
import type { ReactNode } from "react";
import type { ViewStyle, TextStyle, StyleProp } from "react-native";
import { Pressable, Text, StyleSheet } from "react-native";

import { colors } from "@/config/constants";

type Variant = "primary" | "outline" | "soft";
type Tone = "brand" | "warning";

type Props = {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  variant?: Variant;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

// convert "#RRGGBB" -> "rgba(r,g,b,a)"
function hexToRgba(hex: string, alpha = 0.15): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function Button({
  children,
  onPress,
  disabled,
  accessibilityLabel,
  variant = "primary",
  tone = "brand",
  style,
  textStyle
}: Props) {
  const { container, text } = getStyles(variant, tone);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.base, container, disabled && styles.disabled, style]}
      hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
    >
      <Text style={[styles.text, text, textStyle]}>{children}</Text>
    </Pressable>
  );
}

function getStyles(variant: Variant, tone: Tone) {
  const isBrand = tone === "brand";
  const accent = isBrand ? colors.primary : colors.warning;
  const onAccent = colors.primaryText;

  const container: ViewStyle =
    variant === "primary"
      ? { backgroundColor: accent, borderColor: accent }
      : variant === "outline"
        ? { backgroundColor: "transparent", borderColor: colors.outline }
        : { backgroundColor: hexToRgba(accent, 0.15), borderColor: accent };

  const text: TextStyle =
    variant === "primary"
      ? { color: onAccent }
      : variant === "outline"
        ? { color: colors.text }
        : { color: accent };

  return { container, text };
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 12
  },
  disabled: {
    opacity: 0.7
  },
  text: { fontWeight: "800" }
});
