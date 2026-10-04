import { defineConfig, enforceVariants } from "monoswan";

export default defineConfig({
	variants: {
		"my-library": {
			packageJson: {
				scripts: {
					build: "tsdown",
					check: "tsc --noEmit",
				},
			},
			tsConfig: {
				compilerOptions: {
					strict: true,
				},
			},
		},
	},
	rules: [enforceVariants()],
});
