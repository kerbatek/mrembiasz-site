import js from "@eslint/js";
import astro from "eslint-plugin-astro";
import sonarjs from "eslint-plugin-sonarjs";
import globals from "globals";

export default [
  {
    ignores: [
      "dist/**",
      ".astro/**",
      "node_modules/**",
      "**/.terraform/**",
      ".venv/**",
      "coverage/**",
    ],
  },
  js.configs.recommended,
  ...astro.configs.recommended,
  sonarjs.configs.recommended,
  {
    files: ["**/*.js", "**/*.mjs", "**/*.astro"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      complexity: ["error", 8],
      "max-depth": ["error", 4],
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "sonarjs/cognitive-complexity": ["error", 10],
    },
  },
];
