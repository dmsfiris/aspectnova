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

import ExpoConstants from "expo-constants";
import { Platform } from "react-native";

/** Matches app.config.ts extra shape */
type Extra = {
  apiBaseUrl?: string;
  appWebOrigin?: string;
  apiDebug?: string | number;
  appBrandName?: string;
  eas?: { projectId?: string };
  demoImages?: boolean | string | number;
  /** "picsum" | "unsplash" | "dummyimage" | "placehold" | "data" */
  demoImageProvider?: string;
  allowedImageHosts?: string | string[];
};

const extra = (ExpoConstants.expoConfig?.extra ?? {}) as Extra;

/** Safe, typed access to process.env across RN/Web/SSR */
type Proc = { env?: Record<string, string | undefined> };
function getEnv(key: string): string | undefined {
  try {
    const proc =
      typeof process !== "undefined" ? (process as unknown as Proc) : undefined;
    // Prefer EXPO_PUBLIC_* at runtime on web/EAS, then plain KEY
    const expoPublic = proc?.env?.[`EXPO_PUBLIC_${key}`];
    return expoPublic ?? proc?.env?.[key];
  } catch {
    return undefined;
  }
}

/** Runtime-aware defaults */
export const IS_WEB = Platform.OS === "web";
const RUNTIME_ORIGIN =
  typeof window !== "undefined" && typeof window.location?.origin === "string"
    ? window.location.origin
    : undefined;

/** Narrow the web bundler type from expoConfig without using any */
type ExpoWebConfig = { bundler?: "metro" | "webpack" };
const WEB_BUNDLER =
  (ExpoConstants.expoConfig?.web as ExpoWebConfig | undefined)?.bundler ?? undefined;

/**
 * Smart default for APP_WEB_ORIGIN
 */
const DEFAULT_WEB_FALLBACK =
  WEB_BUNDLER === "metro" ? "http://localhost:8081" : "http://localhost:19006";

const DEFAULT_APP_WEB_ORIGIN = IS_WEB
  ? (RUNTIME_ORIGIN ?? DEFAULT_WEB_FALLBACK)
  : "http://localhost:8081";

/** Basic URL validator with support for mock:// scheme (non-throwing) */
function isValidUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() === "") return false;
  if (/^mock:\/\/\S+/i.test(value)) return true; // allow mock://
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/** Parse booleans from many shapes: 1/0, true/false, yes/no, on/off */
function parseBool(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(s)) return true;
    if (["0", "false", "no", "off"].includes(s)) return false;
  }
  return fallback;
}

/** Parse comma/space separated list or array into string[] */
function parseHostList(v: unknown): string[] {
  const toArr = Array.isArray(v)
    ? v.map(String)
    : typeof v === "string"
      ? v.split(/[,\s]+/u)
      : [];
  // normalize to lowercase + dedupe
  const seen = new Set<string>();
  for (const s of toArr.map(s => s.trim().toLowerCase()).filter(Boolean)) {
    seen.add(s);
  }
  return Array.from(seen);
}

/** Public, typed shape of env for imports/tests/tooling */
export type Env = Readonly<{
  API_BASE_URL: string;
  APP_WEB_ORIGIN: string;
  API_DEBUG?: string | number;
  EAS_PROJECT_ID: string;
  EAS_UPDATE_URL?: string;
  APP_BRAND_NAME: string;
}>;

/**
 * Centralized environment configuration.
 * Precedence: app.config.ts (extra) → process.env / EXPO_PUBLIC_* → smart defaults.
 */
const _env = Object.freeze({
  API_BASE_URL: extra.apiBaseUrl ?? getEnv("API_BASE_URL") ?? "http://localhost:3000",
  APP_WEB_ORIGIN:
    extra.appWebOrigin ?? getEnv("APP_WEB_ORIGIN") ?? DEFAULT_APP_WEB_ORIGIN,
  API_DEBUG: extra.apiDebug ?? getEnv("API_DEBUG"),
  EAS_PROJECT_ID: extra.eas?.projectId ?? getEnv("EAS_PROJECT_ID") ?? "",
  EAS_UPDATE_URL: ExpoConstants.expoConfig?.updates?.url ?? getEnv("EAS_UPDATE_URL"),
  APP_BRAND_NAME: extra.appBrandName ?? getEnv("APP_BRAND_NAME") ?? "MyAppName"
}) satisfies Env;

/** Image-related config (exported individually) */
export const DEMO_IMAGES: boolean = parseBool(
  extra.demoImages,
  parseBool(getEnv("DEMO_IMAGES"), false)
);

export type DemoImageProvider =
  | "picsum"
  | "unsplash"
  | "dummyimage"
  | "placehold"
  | "data";

export const DEMO_IMAGE_PROVIDER: DemoImageProvider = (() => {
  const raw = (extra.demoImageProvider ?? getEnv("DEMO_IMAGE_PROVIDER") ?? "")
    .toString()
    .trim()
    .toLowerCase();
  if (raw === "picsum") return "picsum";
  if (raw === "unsplash") return "unsplash";
  if (raw === "placehold") return "placehold";
  if (raw === "data") return "data";
  return "dummyimage"; // default
})();

export const ALLOWED_IMAGE_HOSTS: string[] = (() => {
  let list = parseHostList(extra.allowedImageHosts);
  if (list.length === 0) list = parseHostList(getEnv("ALLOWED_IMAGE_HOSTS"));

  // Only auto-allow Unsplash when we are actually in DEMO mode using the Unsplash provider.
  if (DEMO_IMAGES && DEMO_IMAGE_PROVIDER === "unsplash") {
    if (!list.includes("images.unsplash.com")) {
      list = [...list, "images.unsplash.com"];
    }
  }
  return list;
})();

/** Convenience flag for feature toggles in the app */
export const IS_MOCK_API =
  typeof _env.API_BASE_URL === "string" && /^mock:\/\//i.test(_env.API_BASE_URL);

/**
 * Dev-time validation with friendly messages.
 * In production builds, fail-fast on misconfiguration to prevent runtime errors.
 */
(function validateEnv() {
  const errors: string[] = [];

  const apiBase = _env.API_BASE_URL;
  const appOrigin = _env.APP_WEB_ORIGIN;
  const brand = _env.APP_BRAND_NAME;

  if (!isValidUrl(apiBase)) {
    errors.push(
      'API_BASE_URL is invalid: "' +
        String(apiBase) +
        '". Use a full URL (e.g., https://api.example.com) or mock://local for mock mode.'
    );
  }
  if (!isValidUrl(appOrigin)) {
    errors.push(
      'APP_WEB_ORIGIN is invalid: "' +
        String(appOrigin) +
        '". Use the actual origin or the bundler-appropriate default (Metro: http://localhost:8081, Webpack: http://localhost:19006).'
    );
  }
  if (!brand || typeof brand !== "string") {
    errors.push("APP_BRAND_NAME is missing or invalid. Set a non-empty name.");
  }
  if (!Array.isArray(ALLOWED_IMAGE_HOSTS)) {
    errors.push("ALLOWED_IMAGE_HOSTS must be a comma/space separated list or array.");
  }

  if (errors.length) {
    const msg = "[env] Invalid environment configuration:\n- " + errors.join("\n- ");
    const isDev = typeof __DEV__ !== "undefined" && __DEV__ === true;
    if (isDev) {
      // eslint-disable-next-line no-console
      console.error(msg);
    } else {
      throw new Error(msg);
    }
  }
})();

/** Public singleton — typed */
export const env: Env = _env;

/** Helpful dev log to verify image settings early (tree-shaken in prod builds) */
if (typeof __DEV__ !== "undefined" && __DEV__) {
  // eslint-disable-next-line no-console
  console.log(
    "[env] images → demo:",
    DEMO_IMAGES,
    "provider:",
    DEMO_IMAGE_PROVIDER,
    "hosts:",
    ALLOWED_IMAGE_HOSTS
  );
}
