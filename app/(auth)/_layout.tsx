// app/(auth)/_layout.tsx
import { Stack } from "expo-router";
import React from "react";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, presentation: "card" }}>
      {/* You can add more auth screens later; for now we ensure the group exists */}
      <Stack.Screen name="login" options={{ headerShown: false }} />
    </Stack>
  );
}
