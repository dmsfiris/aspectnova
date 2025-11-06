// app/(tabs)/_layout.tsx
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Platform, useWindowDimensions, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { UniversalTabButton } from "@/components/ui/UniversalTabButton";
import { colors, spacing } from "@/config/constants";
import { fonts, palette } from "@/config/theme";

export default function TabsLayout(): JSX.Element {
  const { t, ready } = useTranslation();
  const { width } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();

  // ─────────────────────────────────────────────
  // Responsive breakpoints
  // ─────────────────────────────────────────────
  const WIDE = width >= 760;
  const MEDIUM = width >= 480 && width < 760;
  const COMPACT = width < 480;
  const XSMALL = width < 340;

  const showLabels = !COMPACT;
  const besideIcon = WIDE;

  // ─────────────────────────────────────────────
  // Sizes & layout
  // ─────────────────────────────────────────────
  const itemMinWidth = WIDE ? 128 : MEDIUM ? 100 : XSMALL ? 70 : 88;
  const baseIconSize = WIDE ? 26 : MEDIUM ? 24 : 22;
  const labelFontSize = WIDE ? 14 : MEDIUM ? 12 : 0;

  const barBaseH = WIDE ? 60 : MEDIUM ? 58 : 54;
  const barHeight = Platform.OS === "ios" ? barBaseH + Math.min(bottom, 12) : barBaseH;

  // ─────────────────────────────────────────────
  // Icon mapping per route
  // ─────────────────────────────────────────────
  const iconMap = useMemo(
    () => ({
      home: { active: "home", inactive: "home-outline" },
      library: { active: "book", inactive: "book-outline" },
      notifications: { active: "notifications", inactive: "notifications-outline" },
      profile: { active: "person", inactive: "person-outline" }
    }),
    []
  );

  if (!ready) return null;

  // ─────────────────────────────────────────────
  // Tab navigation config
  // ─────────────────────────────────────────────
  return (
    <Tabs
      initialRouteName="home"
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },

        // ─── Colors
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: colors.mutedText,
        tabBarAllowFontScaling: false,
        tabBarShowLabel: showLabels,

        // ─── Layout & visuals
        tabBarStyle: {
          backgroundColor:
            Platform.OS === "web" ? "rgba(255,255,255,0.88)" : colors.background,
          borderTopWidth: Platform.OS === "web" ? 1 : 0.5,
          borderTopColor: colors.border,
          height: barHeight,
          paddingHorizontal: 0,
          paddingVertical: 0,
          // @ts-expect-error RN Web-only style
          backdropFilter: Platform.OS === "web" ? "blur(8px)" : undefined
        },

        // ─── Tab item layout
        tabBarItemStyle: {
          minWidth: itemMinWidth,
          paddingHorizontal: COMPACT ? spacing.sm : spacing.md,
          justifyContent: showLabels ? (besideIcon ? "center" : "flex-end") : "center",
          alignItems: "center"
        },

        // ─── Icon container
        tabBarIconStyle: showLabels
          ? undefined
          : ({
              alignSelf: "center",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
              marginTop: 0,
              marginBottom: 0
            } as ViewStyle),

        // ─── Label styling
        // Supported at runtime on @react-navigation/bottom-tabs v6+, but types may lag
        // @ts-expect-error label position option exists at runtime
        tabBarLabelPosition: besideIcon ? "beside-icon" : "below-icon",
        tabBarLabelStyle: {
          fontSize: showLabels ? labelFontSize : 0,
          marginTop: besideIcon ? 0 : showLabels ? 2 : 0,
          marginLeft: besideIcon && showLabels ? 6 : 0,
          fontWeight: besideIcon ? "600" : "500",
          fontFamily: fonts.text,
          color: colors.text
        },

        // ─── Icon rendering
        tabBarIcon: ({ color, focused }) => {
          const map =
            iconMap[route.name as keyof typeof iconMap] ??
            ({ active: "ellipse", inactive: "ellipse-outline" } as const);
          const name = (
            focused ? map.active : map.inactive
          ) as keyof typeof Ionicons.glyphMap;
          return <Ionicons name={name} color={color} size={baseIconSize} />;
        },

        // ─── SPA-safe, haptics-friendly tab button
        tabBarButton: props => <UniversalTabButton {...props} />,

        tabBarTestID: `tab-${route.name}`
      })}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t("tabs.home", { defaultValue: "Home" }),
          tabBarLabel: showLabels ? t("tabs.home", { defaultValue: "Home" }) : undefined
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: t("tabs.library", { defaultValue: "Library" }),
          tabBarLabel: showLabels
            ? t("tabs.library", { defaultValue: "Library" })
            : undefined
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t("tabs.notifications", { defaultValue: "Notifications" }),
          tabBarLabel: showLabels
            ? t("tabs.notifications", { defaultValue: "Notifications" })
            : undefined
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile", { defaultValue: "Profile" }),
          tabBarLabel: showLabels
            ? t("tabs.profile", { defaultValue: "Profile" })
            : undefined
        }}
      />
    </Tabs>
  );
}
