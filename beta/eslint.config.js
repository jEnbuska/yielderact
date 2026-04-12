import eslint from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import tseslint from "typescript-eslint";
import noFloatingGenerators from "./eslint-rules/no-floating-generators.js";

export default tseslint.config(
  {
    ignores: ["node_modules/**", "dist/**", "eslint-rules/**", "playground/**", "eslint.config.js"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      yract: {
        rules: {
          "no-floating-generators": noFloatingGenerators,
        },
      },
    },
    rules: {
      "@typescript-eslint/no-namespace": ["error", { allowDeclarations: true }],
      "@typescript-eslint/no-empty-object-type": ["error", { allowInterfaces: "with-single-extends" }],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/consistent-type-imports": "warn",
      "yract/no-floating-generators": "error",
      "require-yield": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
);
