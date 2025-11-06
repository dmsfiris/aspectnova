// src/app/(tabs)/profile.tsx
import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";

import Button from "@/components/ui/Button";
import SectionTitle from "@/components/ui/SectionTitle";
import { useAuth } from "@/store/useAuth";

export default function ProfileScreen(): JSX.Element {
  // Use properly typed Zustand selectors — ensures no unsafe any assignments
  const user = useAuth(state => state.user);
  const logout = useAuth(state => state.logout);

  return (
    <View style={styles.container} accessibilityRole="summary">
      <SectionTitle>Profile</SectionTitle>

      <View style={styles.card}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.value}>{user?.email ?? "guest"}</Text>

        <View style={{ height: 12 }} />

        <Button onPress={logout}>
          <Text style={styles.logoutText}>Sign out</Text>
        </Button>
      </View>

      <Pressable
        style={styles.linkRow}
        accessibilityRole="button"
        accessibilityLabel="Privacy policy"
        onPress={() => {}}
      >
        <Text style={styles.linkText}>Privacy Policy</Text>
      </Pressable>

      <Pressable
        style={styles.linkRow}
        accessibilityRole="button"
        accessibilityLabel="Terms of service"
        onPress={() => {}}
      >
        <Text style={styles.linkText}>Terms of Service</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  card: {
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#fff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb"
  },
  label: { color: "#6b7280", marginBottom: 4 },
  value: { fontSize: 16, fontWeight: "700" },
  logoutText: { color: "#fff", fontWeight: "700" },
  linkRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb"
  },
  linkText: { color: "#2563eb", fontWeight: "600" }
});
