// src/hooks/use-theme-color.ts
import { useColorScheme } from "react-native";

type Key = "text" | "background" | "tint" | "link";

const light: Record<Key, string> = {
  text: "#111827",
  background: "#ffffff",
  tint: "#2563eb",
  link: "#0a7ea4"
};

const dark: Record<Key, string> = {
  text: "#e5e7eb",
  background: "#0b0b0b",
  tint: "#60a5fa",
  link: "#38bdf8"
};

export function useThemeColor(props: { light?: string; dark?: string }, colorName: Key) {
  const scheme = useColorScheme(); // "light" | "dark" | null
  const override = props[scheme ?? "light"];
  if (override) return override;
  return (scheme === "dark" ? dark : light)[colorName];
}
