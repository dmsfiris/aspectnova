// src/hooks/use-color-scheme.web.ts
import { useColorScheme as useRNColorScheme } from "react-native";

// Web simply delegates to RN hook; no state updates inside effects needed.
export function useColorScheme() {
  return useRNColorScheme();
}
