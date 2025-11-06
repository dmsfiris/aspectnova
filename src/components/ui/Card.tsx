// src/components/ui/Card.tsx
import React from "react";
import { View, StyleSheet } from "react-native";
import type { ViewProps } from "react-native";

import { colors, radius, shadow } from "@/config/constants";

export default function Card({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.card, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 12,
    ...shadow.card
  }
});
