import { defineConfig, enforceVariants, sortPackageJson } from "monoswan";

export default defineConfig({
	variants: {
		"my-library": {
			packageJson: { type: "module" },
			tsConfig: { compilerOptions: { strict: true } },
			initialization: {
				packageJson: { version: "0.0.0" },
				additionalTextFiles: { "src/index.ts": "export {};\n" },
			},
		},
	},
	rules: [enforceVariants(), sortPackageJson()],
});
