// https://docs.expo.dev/guides/using-eslint/
import { defineConfig } from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";

export default defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
    rules: {
      // Local service modules intentionally expose both named and default APIs.
      // The import plugin reports noisy false positives for that pattern.
      "import/no-named-as-default": "off",
      "import/no-named-as-default-member": "off",
      // Native modules are lazy-required in a few services so Expo Go can fail gracefully.
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);
