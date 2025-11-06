/**
 * Copyright (c) 2025 AspectSoft
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Single source of truth for design tokens used across your UI components.
// Lowercase exports, with explicit keys for everything your components reference.

import { Platform } from "react-native";

// ====================== Colors ======================
export const colors = {
  // Base
  background: "#ffffff",
  surface: "#f9fafb",
  surface2: "#f3f4f6",
  text: "#111827",
  textInverse: "#ffffff",
  mutedText: "#6b7280",

  // Borders & outlines
  border: "#e5e7eb",
  outline: "#cbd5e1", // focus rings / outlines

  // Cards / panels (alias kept for older components like ActionMenu)
  card: "#ffffff",

  // Brand / primary
  primary: "#2563eb",
  primaryText: "#ffffff",

  // Secondary (optional but handy)
  secondary: "#7c3aed",
  secondaryText: "#ffffff",

  // Feedback
  success: "#10b981",
  successText: "#052e1b",
  warning: "#f59e0b",
  warningText: "#111827",
  danger: "#dc2626",
  dangerText: "#ffffff",
  info: "#0ea5e9",
  infoText: "#06202a",

  // Overlays
  overlay: "rgba(0,0,0,0.35)"
} as const;

// ====================== Spacing ======================
export const spacing = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28
} as const;

// ====================== Radius ======================
export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999
} as const;

// ====================== Shadows ======================
export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  popover: {
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4
  },
  modal: {
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8
  }
} as const;

// ====================== Typography ======================
export const font = {
  title: { fontSize: 18, fontWeight: "600" as const, lineHeight: 22 },
  subtitle: { fontSize: 16, fontWeight: "500" as const, lineHeight: 20 },
  body: { fontSize: 16, lineHeight: 20 },
  small: { fontSize: 14, lineHeight: 18 },
  // Platform-safe mono
  mono: {
    fontFamily:
      Platform.select({
        ios: "Menlo",
        default: "monospace"
      }) ?? "monospace"
  }
} as const;

// ====================== Z-Index ======================
export const zIndex = {
  dropdown: 20,
  tooltip: 25,
  modal: 30,
  toast: 40,
  overlay: 50
} as const;

// ====================== Timing (animations) ======================
export const timing = {
  fast: 120,
  normal: 200,
  slow: 320
} as const;

// ====================== Opacity helpers ======================
export const opacity = {
  disabled: 0.5,
  overlay: 0.35
} as const;

// ====================== Breakpoints (web-only helpers) ======================
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024
} as const;

// ====================== Component-level defaults (optional) ======================
export const buttonTokens = {
  height: 40,
  paddingH: spacing.md,
  radius: radius.lg,
  variants: {
    primary: { bg: colors.primary, fg: colors.primaryText, border: colors.primary },
    secondary: {
      bg: colors.secondary,
      fg: colors.secondaryText,
      border: colors.secondary
    },
    ghost: { bg: "transparent", fg: colors.text, border: colors.border },
    warn: { bg: colors.warning, fg: colors.warningText, border: colors.warning },
    danger: { bg: colors.danger, fg: colors.dangerText, border: colors.danger },
    success: { bg: colors.success, fg: colors.successText, border: colors.success },
    info: { bg: colors.info, fg: colors.infoText, border: colors.info }
  }
} as const;

export const cardTokens = {
  bg: colors.card,
  border: colors.border,
  radius: radius.lg,
  shadow: shadow.card
} as const;

export const inputTokens = {
  height: 44,
  paddingH: spacing.md,
  radius: radius.md,
  bg: colors.surface,
  fg: colors.text,
  placeholder: colors.mutedText,
  border: colors.border,
  focusBorder: colors.outline
} as const;

// ====================== Helpful Types ======================
export type Colors = typeof colors;
export type Spacing = typeof spacing;
export type Radius = typeof radius;
export type Shadow = typeof shadow;
export type Font = typeof font;
export type ZIndex = typeof zIndex;
export type Timing = typeof timing;
export type Opacity = typeof opacity;
export type Breakpoints = typeof breakpoints;
export type ButtonTokens = typeof buttonTokens;
export type CardTokens = typeof cardTokens;
export type InputTokens = typeof inputTokens;
