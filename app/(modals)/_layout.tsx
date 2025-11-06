// app/(modals)/_layout.tsx
import { Stack } from "expo-router";
import React from "react";
import { Platform } from "react-native";

export default function ModalsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: "modal",
        animation: "slide_from_bottom",
        gestureEnabled: Platform.OS === "ios"
      }}
    />
  );
}
