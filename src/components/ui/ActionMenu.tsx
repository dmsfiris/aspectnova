// src/components/ui/ActionMenu.tsx
import React, { useEffect } from "react";
import { Modal, View, Pressable, Text, StyleSheet, Platform } from "react-native";

import { colors, radius } from "@/config/constants";

type Action = {
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  actions: Action[];
  cancelLabel?: string; // optional i18n label (defaults to "Cancel")
};

export default function ActionMenu({
  visible,
  onClose,
  actions,
  cancelLabel = "Cancel"
}: Props) {
  // Close on Escape (web)
  useEffect(() => {
    if (Platform.OS !== "web" || !visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Backdrop */}
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close menu"
        style={styles.backdrop}
      />

      {/* Bottom sheet */}
      <View style={styles.sheet} pointerEvents="box-none">
        <View style={styles.sheetBody}>
          {actions.map((a, i) => (
            <Pressable
              key={`${a.label}-${i}`}
              onPress={() => {
                if (a.disabled) return;
                // Close first to keep UI snappy; run action right after
                onClose();
                // Let the close animation tick before executing
                setTimeout(() => a.onPress(), 0);
              }}
              disabled={!!a.disabled}
              accessibilityRole="button"
              accessibilityState={{ disabled: !!a.disabled }}
              style={[styles.item, a.disabled && styles.itemDisabled]}
            >
              <Text style={[styles.itemText, a.danger && styles.danger]}>{a.label}</Text>
            </Pressable>
          ))}

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={[styles.item, styles.cancelItem]}
          >
            <Text style={[styles.itemText, styles.cancelText]}>{cancelLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay // rgba(0,0,0,0.35)
  },
  cancelItem: {
    borderBottomWidth: 0,
    borderTopColor: colors.surface,
    borderTopWidth: 10
  },
  cancelText: {
    fontWeight: "800"
  },
  danger: {
    color: colors.danger
  },
  item: {
    backgroundColor: colors.card,
    borderBottomColor: colors.surface,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  itemDisabled: {
    opacity: 0.5
  },
  itemText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  sheet: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end"
  },
  sheetBody: {
    backgroundColor: colors.card,
    borderColor: colors.outline,
    borderRadius: radius.lg,
    borderWidth: 1,
    margin: 12,
    overflow: "hidden"
  }
});
