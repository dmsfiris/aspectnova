// src/components/ui/SectionTitle.tsx
import React from "react";
import { Text, StyleSheet } from "react-native";
import type { TextProps } from "react-native";

import { colors, font, spacing } from "@/config/constants";

/**
 * Section title label — uppercase and compact.
 * Consistent with your design system.
 */
export default function SectionTitle({ style, children, ...props }: TextProps) {
  return (
    <Text
      {...props}
      style={[styles.title, style]}
      accessibilityRole="header"
      numberOfLines={1}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: {
    ...font.small,
    fontWeight: "800",
    letterSpacing: 0.6,
    opacity: 0.7,
    textTransform: "uppercase",
    color: colors.mutedText,
    marginBottom: spacing.xs
  }
});
