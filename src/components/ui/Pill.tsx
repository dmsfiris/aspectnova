// src/components/ui/Pill.tsx
import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

import { colors } from "@/config/constants";

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export default function Pill({
  label,
  selected,
  onPress,
  style
}: Props): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, selected ? styles.selected : styles.idle, style]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
    >
      <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  idle: {
    backgroundColor: "transparent",
    borderColor: colors.outline
  },
  selected: {
    backgroundColor: `${colors.primary}22`,
    borderColor: colors.primary
  },
  text: {
    fontWeight: "600",
    color: colors.text
  },
  textSelected: {
    color: colors.primary
  }
});
