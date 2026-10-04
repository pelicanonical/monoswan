import type { Task } from "true-myth";
import { all, fromResult, safelyTry } from "true-myth/task";
import path from "node:path";
import type { PackageConfigError } from "./utils/package.ts";
import { loadMonoswanConfig, type LoadMonoswanConfigError } from "./loader.ts";
import { findMonoswanConfig } from "./utils.ts";
import {
	getResolvedPackageVariant,
	type InvalidVariantsError,
	type VariantCreationFailedError,
} from "./utils/variants.ts";
import type { VariantConfig } from "./types/variant.ts";
import type { LintRule, LintRuleContext, LintRuleError } from "./types/rule.ts";
import { getRepoPackages, isPackageIgnored, type GetRepoPackagesError } from "./utils/repo.ts";
import type { DoesFileExistError, ReadFileContentsError } from "./utils/file.ts";
import type { PackageManifestContext } from "./types/context.ts";
import type { MonoswanConfig } from "./types/root-config.ts";
import { DEFAULT_IGNORE_CONFIG } from "./types/package-config.ts";
import { createIgnoreMatchers, getRulesByPackage } from "./utils/rule.ts";
import type { FailedToMergeVariantError } from "./utils/merge.ts";

export type LintError =
	| { type: "CONFIG_NOT_FOUND" }
	| LoadMonoswanConfigError
	| GetRepoPackagesError
	| PackageConfigError
	| InvalidVariantsError
	| VariantCreationFailedError
	| FailedToMergeVariantError
	| { type: "FAILED_TO_CREATE_GLOB_MATCHER"; error: unknown }
	| { type: "FAILED_TO_RUN_CHECK"; error: unknown }
	| DoesFileExistError
	| ReadFileContentsError;

const isWithinPath = (parentPath: string, childPath: string): boolean => {
	const relativePath = path.relative(parentPath, childPath);
	return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
};

const getPackagesInLintScope = (
	packages: PackageManifestContext[],
	lintPath: string,
): PackageManifestContext[] => {
	const packagesWithinScope = packages.filter((pkg) => isWithinPath(lintPath, pkg.packagePath));
	if (packagesWithinScope.length > 0) return packagesWithinScope;

	const containingPackage = packages
		.filter((pkg) => isWithinPath(pkg.packagePath, lintPath))
		.toSorted((left, right) => right.packagePath.length - left.packagePath.length)[0];
	return containingPackage == null ? [] : [containingPackage];
};

export const lint = (absolutePathName: string): Task<LintRuleError[], LintError> =>
	fromResult(findMonoswanConfig(absolutePathName)).andThen((configPath) => {
		const workspaceRoot = path.dirname(configPath);
		return all([loadMonoswanConfig(configPath), getRepoPackages(workspaceRoot)]).andThen(
			([monoswanConfig, packages]) =>
				fromResult(createIgnoreMatchers(monoswanConfig.ignore ?? DEFAULT_IGNORE_CONFIG)).andThen(
					([isIgnoredPath, isIgnoredPackage]) =>
						lintPackages(
							getPackagesInLintScope(packages, absolutePathName).filter(
								(pkg) => !isPackageIgnored(pkg, workspaceRoot, isIgnoredPath, isIgnoredPackage),
							),
							monoswanConfig,
							workspaceRoot,
						),
				),
		);
	});

const lintPackages = (
	packages: PackageManifestContext[],
	config: MonoswanConfig,
	repoPath: string,
) =>
	getRulesByPackage(packages, config.rules ?? [], repoPath).andThen((rulesByPackage) =>
		all(
			packages.map((pkg) =>
				getResolvedPackageVariant(pkg, config).andThen((resolvedVariantConfig) =>
					validatePackage(pkg, resolvedVariantConfig, rulesByPackage.get(pkg) ?? []),
				),
			),
		).map((errors) => errors.flat()),
	);

const validatePackage = (
	pkg: PackageManifestContext,
	variant: VariantConfig,
	rules: LintRule[],
): Task<LintRuleError[], { type: "FAILED_TO_RUN_CHECK"; error: unknown }> => {
	const lintRuleContext: LintRuleContext = {
		variant,
		packageJson: pkg.packageJson,
		packageName: pkg.packageName,
		packagePath: pkg.packagePath,
	};

	return all(
		rules.map((rule) =>
			safelyTry(async () => rule.check(lintRuleContext)).mapRejected((error) => ({
				type: "FAILED_TO_RUN_CHECK" as const,
				error,
			})),
		),
	).map((errors) => errors.flat());
};
