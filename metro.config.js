const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Drizzle's generated migrations.js imports the raw .sql files.
config.resolver.sourceExts.push("sql");

module.exports = withNativeWind(config, { input: "./global.css" });
