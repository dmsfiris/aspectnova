// metro.config.js
const path = require("path");

const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Treat .mjs/.cjs as source (helps some deps)
config.resolver.assetExts = (config.resolver.assetExts || []).filter(
  ext => ext !== "mjs" && ext !== "cjs"
);
config.resolver.sourceExts = Array.from(
  new Set([...(config.resolver.sourceExts || []), "mjs", "cjs"])
);

// Simple alias for "@/..."
config.resolver.alias = {
  ...(config.resolver.alias || {}),
  "@": path.resolve(__dirname)
};

// Prefer CJS when present (generally safer for Metro web)
config.resolver.resolverMainFields = ["react-native", "main", "module", "browser"];

module.exports = config;
