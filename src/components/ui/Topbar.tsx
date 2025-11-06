// src/components/ui/Topbar.tsx
import React, { memo } from "react";
import { View, Text, StyleSheet, Platform, useWindowDimensions } from "react-native";

type Props = {
  title: string;
  bgColor: string;
  textColor: string;
  dividerColor: string;
  maxContentWidth?: number;
  sidePadding?: number;
};

const Topbar = memo(function Topbar({
  title,
  bgColor,
  textColor,
  dividerColor,
  maxContentWidth = 920,
  sidePadding = 16
}: Props) {
  const { width } = useWindowDimensions();

  // ✅ Dynamically scale font size by screen width
  const fontSize =
    width < 360
      ? 20 // very small phones
      : width < 480
        ? 24 // regular phones
        : width < 768
          ? 28
          : 30; // tablets and larger

  return (
    <View
      style={[
        styles.topbar,
        { backgroundColor: bgColor, borderBottomColor: dividerColor }
      ]}
    >
      <View
        style={[
          styles.topbarInner,
          { maxWidth: maxContentWidth, paddingHorizontal: sidePadding }
        ]}
      >
        <Text
          accessibilityRole="header"
          style={[
            styles.brand,
            {
              color: textColor,
              fontSize // apply responsive size
            }
          ]}
        >
          {title}
        </Text>
      </View>
    </View>
  );
});

export default Topbar;

const styles = StyleSheet.create({
  topbar: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  topbarInner: {
    alignSelf: "center",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 24
  },
  brand: {
    fontFamily: Platform.OS === "web" ? '"Playfair Display", serif' : "Playfair Display",
    fontWeight: "700",
    letterSpacing: 0.2,
    textAlign: "center",
    alignSelf: "center",
    lineHeight: Platform.OS === "web" ? 22 : undefined
  }
});
