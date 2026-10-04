import { defineConfig, sortPackageJson } from "monoswan";

export default defineConfig({
  rules: [
    sortPackageJson(undefined, {
      ignore: { paths: ["packages/legacy/**"] },
    }),
  ],
});
