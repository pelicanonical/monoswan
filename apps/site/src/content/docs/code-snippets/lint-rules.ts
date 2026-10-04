import { defineConfig, enforceVariants, requireMonoswanConfig, sortPackageJson } from "monoswan";

export default defineConfig({
	rules: [requireMonoswanConfig({ requireVariant: true }), enforceVariants(), sortPackageJson()],
});
