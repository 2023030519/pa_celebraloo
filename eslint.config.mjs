import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Herramientas de diseño instaladas en el repo (Impeccable, bunshin): no son código del panel.
    ".agent/**",
    ".claude/**",
    ".cursor/**",
    ".gemini/**",
    ".opencode/**",
    ".bunshin/**",
    ".impeccable/**", "apk/**",
  ]),
]);

export default eslintConfig;
