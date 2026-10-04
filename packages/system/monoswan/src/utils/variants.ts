import { isNotNil } from "es-toolkit";
import { Result } from "true-myth";
import { all as allResults, tryOrElse } from "true-myth/result";
import { mergeVariants } from "./merge.ts";
import type { MonoswanConfig } from "../types/root-config.ts";
import type { PackageContext, PackageManifestContext } from "../types/context.ts";
import { loadPackageConfig, getPackageVariantNames } from "./package.ts";
import type { VariantConfig } from "../types/variant.ts";
import type { FailedToMergeVariantError } from "./merge.ts";

export interface InvalidVariantsError {
	type: "INVALID_VARIANTS";
	packagePath: string;
	variantNames: string[];
}

export interface VariantCreationFailedError {
	type: "VARIANT_CREATION_FAILED";
	packagePath: string;
	variantNames: string[];
	error: Error;
}

export const getResolvedPackageVariant = (pkg: PackageManifestContext, config: MonoswanConfig) =>
	loadPackageConfig(pkg)
		.map(getPackageVariantNames)
		.andThen((variantNames) => resolvePackageVariants(variantNames, config, pkg));

export const resolvePackageVariants = (
	variantNames: string[],
	config: MonoswanConfig,
	packageContext: PackageContext,
): Result<
	VariantConfig,
	InvalidVariantsError | VariantCreationFailedError | FailedToMergeVariantError
> => {
	return resolveVariants(variantNames, config, packageContext).andThen((variants) =>
		mergeVariants(variants, config.merge, packageContext),
	);
};

const resolveVariants = (
	variantNames: string[],
	config: MonoswanConfig,
	packageContext: PackageContext,
): Result<VariantConfig[], InvalidVariantsError | VariantCreationFailedError> => {
	const variants = variantNames.map((variant) => config.variants?.[variant]);
	const invalidVariantNames = variantNames.filter((_, index) => !isNotNil(variants[index]));

	if (invalidVariantNames.length > 0 || !variants.every(isNotNil)) {
		return Result.err({
			type: "INVALID_VARIANTS",
			packagePath: packageContext.packagePath,
			variantNames: invalidVariantNames,
		} as const);
	}

	return allResults(
		variants.map((variant) =>
			typeof variant === "function"
				? tryOrElse(
						(error): VariantCreationFailedError => ({
							type: "VARIANT_CREATION_FAILED",
							packagePath: packageContext.packagePath,
							variantNames,
							error: error instanceof Error ? error : new Error(String(error), { cause: error }),
						}),
						() => variant(packageContext),
					)
				: Result.ok(variant),
		),
	);
};
