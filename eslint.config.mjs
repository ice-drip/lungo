import antfu from "@antfu/eslint-config";

export default antfu({
  type: "lib",
  stylistic: {
    quotes: "double",
    semi: true,
  },
  ignores: ["dist/", "node_modules/"],
  typescript: {
    overrides: {
      "ts/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  test: {
    overrides: {
      "ts/no-explicit-any": "off",
      "ts/no-require-imports": "off",
    },
  },
});
