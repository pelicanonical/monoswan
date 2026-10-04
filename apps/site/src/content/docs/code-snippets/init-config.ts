import { defineConfig, enforceVariants, sortPackageJson } from "monoswan";

export default defineConfig({
  variants: {
    lib: {},
  },
  rules: [enforceVariants(), sortPackageJson()],
});
