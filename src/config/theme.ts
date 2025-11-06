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

import { Platform } from "react-native";

import { colors, spacing } from "./constants";

/** Layout primitives shared across screens */
export const layout = {
  contentMaxW: 920,
  pagePadX: spacing.lg // 16
} as const;

/** Platform-safe font stacks (arrays ensure correct escaping on React Native Web) */
const WEB_TEXT_STACK = [
  "Roboto",
  "system-ui",
  "-apple-system",
  "Segoe UI",
  "Arial",
  "sans-serif"
];

/** Article/content titles should start with Roboto Condensed */
const WEB_CONTENT_TITLE_STACK = [
  "Roboto Condensed",
  "Roboto",
  "system-ui",
  "-apple-system",
  "Segoe UI",
  "Arial",
  "sans-serif"
];

/** Brand/app title should start with Playfair Display */
const WEB_BRAND_TITLE_STACK = [
  "Playfair Display",
  "Roboto Condensed",
  "Roboto",
  "system-ui",
  "-apple-system",
  "Segoe UI",
  "Arial",
  "sans-serif"
];

/** Unified font definitions */
export const fonts = {
  /** For general body text */
  text: Platform.select({
    web: WEB_TEXT_STACK,
    default: "Roboto"
  }),

  /**
   * For article/content titles (FeedRow, FeatureBand, PDF title, etc.)
   * Roboto Condensed first.
   */
  title: Platform.select({
    web: WEB_CONTENT_TITLE_STACK,
    // If Roboto Condensed isn't loaded natively yet, RN will fall back.
    default: "RobotoCondensed-Regular"
  }),

  /**
   * For the app/brand title only (“WebDigestPro”)
   * Playfair Display first.
   */
  brandTitle: Platform.select({
    web: WEB_BRAND_TITLE_STACK,
    default: "PlayfairDisplay-Regular"
  })
} as const;

/** Dark, “tech” palette used on Home */
export const palette = {
  bg: "#0E2239",
  featureBg: "rgb(13, 42, 68)",
  text: "#E6EDF5",
  sub: "#9DB0C6",
  accent: "#47A3F3",
  divider: "#1C2C42"
} as const;

/** Optional light palette derived from base tokens */
export const lightPalette = {
  bg: colors.background,
  featureBg: colors.surface,
  text: colors.text,
  sub: colors.mutedText,
  accent: colors.primary,
  divider: colors.border
} as const;

/** Helpful types for consumers */
export type Layout = typeof layout;
export type Fonts = typeof fonts;
export type Palette = typeof palette;
export type LightPalette = typeof lightPalette;
