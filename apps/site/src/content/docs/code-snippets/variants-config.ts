import { defineConfig } from "monoswan";

export default defineConfig({
	variants: {
		"my-library": {
			packageJson: {
				type: "module",
				scripts: { check: "tsc --noEmit" },
			},
			tsConfig: {
				compilerOptions: { strict: true },
			},
			tsConfigs: {
				"tsconfig.build.json": {
					compilerOptions: { declaration: true },
				},
			},
			additionalJsonFiles: {
				".example.json": { enabled: true },
			},
			additionalTextFiles: {
				".node-version": "22\n",
			},
		},
	},
});
