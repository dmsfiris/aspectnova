// app.config.ts
import "dotenv/config";
import type { ExpoConfig } from "expo/config";

const BRAND = process.env.APP_BRAND_NAME ?? "YourAppName";
const SCHEME = process.env.APP_SCHEME ?? "yourapp";
const SLUG = process.env.APP_SLUG ?? "yourapp";
const IOS_BUNDLE_ID = process.env.IOS_BUNDLE_ID ?? "com.yourcompany.yourapp";
const ANDROID_PACKAGE = process.env.ANDROID_PACKAGE ?? "com.yourcompany.yourapp";

const config: ExpoConfig = {
  name: BRAND,
  slug: SLUG,
  scheme: SCHEME,
  version: process.env.APP_VERSION ?? "1.0.0",
  orientation: "portrait",

  icon: "./assets/images/icon.png",
  splash: {
    image: "./assets/images/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },

  userInterfaceStyle: "automatic",

  assetBundlePatterns: ["**/*"],

  web: {
    favicon: "./assets/images/favicon.png",
    bundler: "metro"
  },

  ios: {
    supportsTablet: true,
    bundleIdentifier: IOS_BUNDLE_ID,
    // Mirror the plugin setting here (helps tooling and Xcode sync)
    deploymentTarget: "15.1",
    infoPlist: {
      LSApplicationQueriesSchemes: [SCHEME]
    }
  },

  android: {
    package: ANDROID_PACKAGE,
    adaptiveIcon: {
      foregroundImage: "./assets/images/icon.png",
      backgroundColor: "#ffffff"
    },
    allowBackup: false
  },

  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-localization",
    "expo-font",
    [
      "expo-build-properties",
      {
        android: {
          minSdkVersion: 24,
          enableProguardInReleaseBuilds: false,
          usesCleartextTraffic: false
        },
        ios: {
          // Raise to meet current Expo SDK requirement
          deploymentTarget: "15.1"
        }
      }
    ]
  ],

  experiments: {
    typedRoutes: true
  },

  runtimeVersion: { policy: "sdkVersion" },
  updates: {
    url: process.env.EAS_UPDATE_URL,
    enabled: true
  },

  extra: {
    apiBaseUrl: process.env.API_BASE_URL ?? "http://localhost:3000",
    appWebOrigin:
      process.env.APP_WEB_ORIGIN ??
      (process.env.WEB_BUNDLER === "webpack"
        ? "http://localhost:19006"
        : "http://localhost:8081"),
    appBrandName: BRAND,
    eas: { projectId: process.env.EAS_PROJECT_ID ?? "" },
    apiDebug: process.env.API_DEBUG ?? "0",

    demoImages: process.env.DEMO_IMAGES,
    demoImageProvider: process.env.DEMO_IMAGE_PROVIDER,
    allowedImageHosts: process.env.ALLOWED_IMAGE_HOSTS,

    router: { origin: process.env.APP_WEB_ORIGIN }
  }
};

export default config;
