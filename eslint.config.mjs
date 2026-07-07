import antfu from "@antfu/eslint-config";

export default antfu(
  {
    type: "lib",
    stylistic: {
      quotes: "double",
      semi: true,
    },
    ignores: ["dist/", "node_modules/"],
    typescript: {
      overrides: {
        // Allow underscore-prefixed unused args (e.g. _stream, _sftp)
        "ts/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      },
    },
    test: {
      overrides: {
        // Tests commonly need `any` for mocks and partial test data
        "ts/no-explicit-any": "off",
        // Integration tests use require() for dynamic imports
        "ts/no-require-imports": "off",
        // Allow describe("CLI help") — uppercase-first test titles
        "test/prefer-lowercase-title": "off",
      },
    },
  },
  {
    rules: {
      // Node.js CLI — process and Buffer are standard globals
      "node/prefer-global/process": "off",
      "node/prefer-global/buffer": "off",
    },
  },
);
