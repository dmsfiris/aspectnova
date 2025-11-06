// app/(tabs)/notifications.tsx
import React from "react";
import { View, Text, StyleSheet, ActivityIndicator, type ViewStyle } from "react-native";

import SectionTitle from "@/components/ui/SectionTitle"; // <-- blank line fixed order

export default function NotificationsScreen(): JSX.Element {
  // Placeholder empty state — swap with your real feed later
  return (
    <View style={styles.container} accessibilityRole="summary">
      <SectionTitle>Notifications</SectionTitle>
      <View style={styles.card}>
        <Text style={styles.title}>You’re all caught up 🎉</Text>
        <Text style={styles.subtitle}>
          We’ll let you know when there’s something new.
        </Text>
        <ActivityIndicator style={{ marginTop: 12 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 } as ViewStyle,
  card: {
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#fff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb"
  },
  title: { fontSize: 16, fontWeight: "700" },
  subtitle: { marginTop: 6, color: "#6b7280" }
});
