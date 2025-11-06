// app/(tabs)/home/_layout.tsx
import { Slot } from "expo-router";
import React, { useEffect, useMemo, useState, createContext, useContext } from "react";
import { View, StyleSheet, Platform } from "react-native";

import TabsBar, { type TabDef } from "@/components/ui/TabsBar";
import Topbar from "@/components/ui/Topbar";
import { env } from "@/config/env";
import { layout, palette, fonts } from "@/config/theme";
import { useCategories, type CategoryItem } from "@/store/useCategories";

/** Context so the Home list can read the selected category (no setter on purpose) */
type CategoryCtx = { selectedKey: string };
const CategoryTabsContext = createContext<CategoryCtx>({ selectedKey: "latest" });
export const useCategoryTabs = (): CategoryCtx => useContext(CategoryTabsContext);

/** Local theming helpers */
const P = layout.pagePadX;
const COLORS = {
  bg: palette.bg,
  featureBg: palette.featureBg,
  text: palette.text,
  sub: palette.sub,
  accent: palette.accent,
  divider: palette.divider
};
const FONT_TITLE = Platform.OS === "web" ? fonts.title : "PlayfairDisplay-Regular";

export default function HomeTabLayout(): JSX.Element {
  // Categories store
  const catItems = useCategories(s => s.items);
  const catsLoading = useCategories(s => s.loading);
  const catsError = useCategories(s => s.error);
  const fetchCatsOnce = useCategories(s => s.fetchOnce);

  // Keep selection persistent while the Home list below re-renders
  const [selectedKey, setSelectedKey] = useState<string>("latest");

  useEffect(() => {
    fetchCatsOnce().catch(() => {});
  }, [fetchCatsOnce]);

  // Build tabs (stable reference)
  const tabs: TabDef[] = useMemo(() => {
    const base: TabDef[] = [{ key: "latest", label: "Latest" }];
    if ((catsLoading || catsError) && catItems.length === 0) return base;
    return base.concat(
      catItems.map((c: CategoryItem) => ({ key: c.key, label: c.label }))
    );
  }, [catItems, catsLoading, catsError]);

  // If the currently selected category disappears from the list, fall back to "latest"
  useEffect(() => {
    if (selectedKey === "latest") return;
    const exists = tabs.some(t => t.key === selectedKey);
    if (!exists) {
      const t = setTimeout(() => setSelectedKey("latest"), 0);
      return () => clearTimeout(t);
    }
  }, [tabs, selectedKey]);

  // Stable colors object so TabsBar doesn’t think props changed every render
  const tabsColors = useMemo(
    () => ({
      bg: COLORS.bg,
      sub: COLORS.sub,
      text: COLORS.text,
      accent: COLORS.accent,
      divider: COLORS.divider
    }),
    []
  );

  return (
    <CategoryTabsContext.Provider value={{ selectedKey }}>
      <View style={styles.page}>
        {/* Persistent top app bar */}
        <Topbar
          title={env.APP_BRAND_NAME}
          bgColor={COLORS.featureBg}
          textColor={COLORS.text}
          dividerColor={COLORS.divider}
          maxContentWidth={layout.contentMaxW}
          sidePadding={P}
          fontFamilyTitle={FONT_TITLE}
        />

        {/* Persistent horizontal category tabs */}
        <TabsBar
          tabs={tabs}
          selectedKey={selectedKey}
          onSelect={k => {
            if (k !== selectedKey) setSelectedKey(k);
          }}
          padX={P}
          colors={tabsColors}
          gap={18}
        />

        {/* Home list content renders here and will re-render without remounting Topbar/TabsBar */}
        <Slot />
      </View>
    </CategoryTabsContext.Provider>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.bg }
});
