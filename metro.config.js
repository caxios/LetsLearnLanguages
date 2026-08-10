const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Drizzle's generated migrations.js imports the raw .sql files.
config.resolver.sourceExts.push("sql");

// expo-sqlite's web worker imports .wasm files; treat them as assets so
// Metro doesn't try to resolve them as JS modules.
config.resolver.assetExts.push("wasm");

module.exports = withNativeWind(config, { input: "./global.css" });
