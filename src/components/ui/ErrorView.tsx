// src/components/ui/ErrorView.tsx
import React from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";

type Props = {
  title?: string;
  message?: string;
  onRetry?: () => void | Promise<void>;
  retryLabel?: string;
  loading?: boolean;
  testID?: string;
};

export function ErrorView({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Try again",
  loading = false,
  testID
}: Props) {
  return (
    <View
      accessibilityRole="alert"
      style={{ padding: 16, alignItems: "center", justifyContent: "center" }}
      testID={testID}
    >
      <Text
        style={{ fontSize: 18, fontWeight: "600", marginBottom: 6, textAlign: "center" }}
      >
        {title}
      </Text>

      {!!message && (
        <Text
          style={{ opacity: 0.8, textAlign: "center", marginBottom: 12, lineHeight: 20 }}
        >
          {message}
        </Text>
      )}

      {onRetry && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
          onPress={() => onRetry()}
          disabled={loading}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: "#111",
            opacity: loading ? 0.7 : 1,
            minWidth: 140,
            alignItems: "center"
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "600" }}>{retryLabel}</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}
