// app/loading.tsx
import React from "react";
import { View, ActivityIndicator } from "react-native";

export default function Loading(): JSX.Element {
  return (
    <View
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading content"
    >
      <ActivityIndicator size="large" color="#111827" />
    </View>
  );
}
