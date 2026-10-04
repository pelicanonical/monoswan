import { defineConfig, sortPackageJson } from "monoswan";

export default defineConfig({
  rules: [sortPackageJson()],
});
