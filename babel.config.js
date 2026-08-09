module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      // Inlines the .sql files that drizzle's generated migrations.js imports.
      ["inline-import", { extensions: [".sql"] }],
    ],
  };
};
