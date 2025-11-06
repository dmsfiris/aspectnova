// src/components/ui/Row.tsx
import React from "react";
import { View, StyleSheet } from "react-native";
import type { ViewProps, ViewStyle } from "react-native";

type Props = ViewProps & {
  /** Gap between children (uses marginRight fallback if gap not supported) */
  gap?: number;
};

export default function Row({
  style,
  gap = 8,
  children,
  ...props
}: Props): React.ReactElement {
  // Detect if `gap` is supported on this platform/runtime
  const base = StyleSheet.flatten(styles.row) as Record<string, unknown>;
  const gapSupported = "gap" in base;

  // Normalize children to an array so we can safely map without `any`
  const childArray = React.Children.toArray(children);

  const childrenWithSpacing = !gapSupported
    ? childArray.map((child, i) =>
        i === childArray.length - 1 ? (
          child
        ) : (
          <View key={i} style={{ marginRight: gap }}>
            {child}
          </View>
        )
      )
    : childArray;

  return (
    <View {...props} style={[styles.row, gapSupported ? { gap } : null, style]}>
      {childrenWithSpacing}
    </View>
  );
}

const styles = StyleSheet.create<{ row: ViewStyle }>({
  row: {
    flexDirection: "row",
    alignItems: "center"
  }
});
