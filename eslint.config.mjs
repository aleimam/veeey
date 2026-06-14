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
    // Generated Prisma client (Prisma 7 `prisma-client` generator output).
    "src/generated/**",
    // Locked design reference — adapted into src/ during P4, not built directly.
    "v0-export/**",
  ]),
]);

export default eslintConfig;
