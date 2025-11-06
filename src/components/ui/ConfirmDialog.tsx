// src/components/ui/ConfirmDialog.tsx
import React, { useEffect, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  Animated,
  Easing,
  Platform,
  StyleSheet
} from "react-native";

import { colors, radius, spacing, shadow } from "@/config/constants";

type Props = {
  visible: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  dismissOnBackdrop?: boolean;
};

export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  dismissOnBackdrop = true
}: Props) {
  const fade = useMemo(() => new Animated.Value(0), []);
  const scale = useMemo(() => new Animated.Value(0.95), []);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: 160,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 0,
          duration: 120,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(scale, {
          toValue: 0.95,
          duration: 120,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true
        })
      ]).start();
    }
  }, [visible, fade, scale]);

  // ESC to close on web
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onKey = (e: KeyboardEvent) => {
      if (!visible) return;
      if (e.key === "Escape") onCancel?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onCancel]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      {/* Backdrop layer (click-to-dismiss if enabled) */}
      <Animated.View
        style={[
          styles.backdrop,
          {
            opacity: fade
          }
        ]}
      >
        {dismissOnBackdrop ? (
          <Pressable
            onPress={onCancel}
            style={StyleSheet.absoluteFillObject}
            accessibilityRole="button"
            accessibilityLabel="Dismiss dialog"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          />
        ) : null}
      </Animated.View>

      {/* Dialog card */}
      <Animated.View
        style={[
          styles.center,
          {
            opacity: fade,
            transform: [{ scale }]
          }
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.card}>
          {!!title && <Text style={styles.title}>{title}</Text>}
          {!!message && <Text style={styles.message}>{message}</Text>}

          <View style={styles.actionsRow}>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
              hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
              style={styles.actionGhost}
            >
              <Text style={styles.actionGhostText}>{cancelLabel}</Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
              style={styles.actionPrimary}
            >
              <Text style={styles.actionPrimaryText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center"
  },
  card: {
    width: "86%",
    maxWidth: 420,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.outline,
    ...shadow.card
  },
  title: {
    fontWeight: "600",
    fontSize: 18,
    marginBottom: 6,
    color: colors.text
  },
  message: {
    color: "#374151",
    marginBottom: 14
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end"
  },
  actionGhost: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: radius.md
  },
  actionGhostText: {
    color: colors.text
  },
  actionPrimary: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md
  },
  actionPrimaryText: {
    color: colors.primaryText,
    fontWeight: "600"
  }
});
