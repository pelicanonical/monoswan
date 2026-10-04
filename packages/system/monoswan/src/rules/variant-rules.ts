import path from "node:path";
import { Task } from "true-myth";
import { validateJson, validateJsonFile, validateTextFile } from "../utils/lint-validation.ts";
import { getPackageJsonPath } from "../utils/paths.ts";
import { all } from "true-myth/task";
import { stringifyJsonFormatted } from "../utils/json.ts";
import { loadPackageConfig } from "../utils/package.ts";
import { DEFAULT_CONFIG, writeMonoswanStandalonePackageConfig } from "../types/package-config.ts";
import { createRule } from "../utils/rule.ts";

export interface RequireMonoswanConfigOptions {
	requireVariant: boolean;
}

export const requireMonoswanConfig = createRule<RequireMonoswanConfigOptions>(
	({ requireVariant }: RequireMonoswanConfigOptions = { requireVariant: false }) => ({
		name: "require-monoswan-config",
		check: async (context) => {
			const result = await loadPackageConfig(context);

			if (result.isErr) {
				return [
					{
						packageContext: context,
						message: `Failed to read and parse monoswan config for this package`,
						filePath: context.packagePath,
					},
				];
			}

			if (result.value == null) {
				return [
					{
						packageContext: context,
						message: `monoswan config is not defined for this package`,
						filePath: context.packagePath,
						autofix: async (autofixContent) =>
							writeMonoswanStandalonePackageConfig(autofixContent.packagePath, DEFAULT_CONFIG),
					},
				];
			}

			if (requireVariant && (result.value.variants == null || result.value.variants.length === 0)) {
				return [
					{
						packageContext: context,
						message: `At least one variant must be defined for this package`,
						filePath: context.packagePath,
					},
				];
			}

			return [];
		},
	}),
);

export const enforceVariants = createRule(() => ({
	name: "enforce-variants",
	check: async (context) => {
		if (context.variant == null) {
			return [];
		}

		const errors = [];

		if (context.variant.packageJson != null) {
			errors.push(
				Task.resolve(
					validateJson(
						context.packageJson,
						context.variant.packageJson,
						getPackageJsonPath(context.packagePath),
						context,
					),
				),
			);
		}

		if (context.variant.tsConfig != null) {
			errors.push(
				validateJsonFile(
					path.join(context.packagePath, "tsconfig.json"),
					context.variant.tsConfig,
					context,
				),
			);
		}

		for (const [filePath, expected] of Object.entries(context.variant.tsConfigs ?? {})) {
			errors.push(validateJsonFile(path.join(context.packagePath, filePath), expected, context));
		}

		for (const [filePath, expected] of Object.entries(context.variant.additionalJsonFiles ?? {})) {
			errors.push(validateJsonFile(path.join(context.packagePath, filePath), expected, context));
		}

		for (const [filePath, expected] of Object.entries(context.variant.additionalTextFiles ?? {})) {
			errors.push(validateTextFile(path.join(context.packagePath, filePath), expected, context));
		}

		return all(errors)
			.map((ruleErrors) => ruleErrors.flat())
			.match({
				Resolved: (value) => value,
				Rejected: (reason) => {
					throw reason.error instanceof Error
						? reason.error
						: new Error(stringifyJsonFormatted(reason.error));
				},
			});
	},
}));
