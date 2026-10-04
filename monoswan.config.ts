// Import directly from the build to avoid turbo monorepo issues.
// Consuming repos just need to import from 'monoswan'
import type {
	defineConfig as defineConfigTypeDefinition,
	enforceVariants as enforceVariantsTypeDefinition,
	sortPackageJson as sortPackageJsonTypeDefinition,
	requireMonoswanConfig as requireMonoswanConfigTypeDefinition,
} from "./packages/system/monoswan/dist/config.d.ts";
import {
	defineConfig,
	enforceVariants,
	sortPackageJson,
	requireMonoswanConfig,
} from "./packages/system/monoswan/dist/config.mjs";
import dedent from "dedent";

export const config = (defineConfig as typeof defineConfigTypeDefinition)({
	variants: {
		lib: {
			packageJson: {
				type: "module",
				scripts: {
					"dev:build": "NODE_ENV=development tsdown",
					build: "NODE_ENV=production tsdown",
					check: "tsc --noEmit",
				},
				devDependencies: {
					"@monoswan/tsdown-lib-plugin": "workspace:*",
					tsdown: "catalog:",
				},
			},
			tsConfig: {
				extends: [
					"@monoswan/typescript-config/library.json",
					"@monoswan/typescript-config/node.json",
				],
			},
			initialization: {
				additionalTextFiles: {
					"vitest.config.ts": dedent`
						import { defineConfig } from "vitest/config";

						export default defineConfig({});
					`,
				},
			},
		},
		astro: {
			packageJson: {
				type: "module",
				scripts: {
					astro: "astro",
					build: "astro build",
					dev: "astro dev",
					"dev:vite-app": "astro dev",
					preview: "astro preview",
				},
			},
			tsConfig: {
				extends: "astro/tsconfigs/strict",
				include: [".astro/types.d.ts", "**/*"],
				exclude: ["dist", "code-snippets"],
			},
		},
	},
	rules: [
		(requireMonoswanConfig as typeof requireMonoswanConfigTypeDefinition)(
			{ requireVariant: true },
			{ ignore: { packages: ["monoswan-repo"] } },
		),
		(enforceVariants as typeof enforceVariantsTypeDefinition)(),
		(sortPackageJson as typeof sortPackageJsonTypeDefinition)(),
	],
	ignore: {
		paths: ["packages/configs/**"],
	},
});

export default config;
