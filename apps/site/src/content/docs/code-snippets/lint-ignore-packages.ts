import { defineConfig, sortPackageJson } from "monoswan";

export default defineConfig({
	rules: [sortPackageJson()],
	ignore: { packages: ["@monorepo/legacy-lib"] },
});
