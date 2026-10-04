import { groupBy } from "es-toolkit";
import { styleText } from "node:util";
import type { LintRuleError } from "../types/rule.ts";
import { getPackageName } from "./package.ts";
import type { LintError } from "../lint.ts";
import { stringifyError } from "./error.ts";
import type { AutofixError } from "../autofix.ts";
import type { CreatePackageError } from "../create-package.ts";
import type { LoadMonoswanConfigError } from "../loader.ts";
import type { DoesFileExistError } from "./file.ts";
import type { PackageConfigError } from "./package.ts";
import type { GetRepoPackages } from "./repo.ts";
import type { InvalidVariantsError, VariantCreationFailedError } from "./variants.ts";
import type { FailedToMergeVariantError } from "./merge.ts";

export type PrintConfigError =
	| { type: "CONFIG_NOT_FOUND" }
	| { type: "PACKAGE_NOT_FOUND"; path: string }
	| LoadMonoswanConfigError
	| DoesFileExistError
	| GetRepoPackages
	| PackageConfigError
	| InvalidVariantsError
	| VariantCreationFailedError
	| FailedToMergeVariantError;

export const formatLintRuleIssue = (errors: LintRuleError[]) => {
	const errorsByPackage = groupBy(errors, (error) => getPackageName(error.packageContext));

	const summary =
		errors.length === 1
			? `Found ${errors.length} lint error`
			: `Found ${errors.length} lint errors`;
	const formattedSummary =
		errors.length === 0 ? styleText("green", summary) : styleText(["bold", "red"], summary);

	const list = Object.entries(errorsByPackage)
		.map(
			([name, errors]) =>
				`${styleText("cyan", name)}\n${errors.map((error) => `  • ${error.message}${error.autofix == null ? "" : styleText("yellow", " (⚙︎ Fix available)")}`).join("\n")}`,
		)
		.join("\n");

	return `${list}\n${formattedSummary}`.trim();
};

const formatLintErrorText = (error: LintError | AutofixError): string => {
	switch (error.type) {
		case "CONFIG_NOT_FOUND": {
			return "Could not find a monoswan configuration.";
		}
		case "CONFIG_LOAD_FAILED": {
			return `Failed to load the monoswan configuration: ${stringifyError(error.cause)}`;
		}
		case "NO_DEFAULT_EXPORT": {
			return "The monoswan configuration must have a default export.";
		}
		case "INVALID_DEFAULT_EXPORT": {
			return "The default export is not a valid monoswan configuration.";
		}
		case "FIND_PACKAGES_FAILED": {
			return `Failed to find workspace packages: ${stringifyError(error.error)}`;
		}
		case "WORKSPACE_NOT_FOUND": {
			return "Could not find a workspace declaration.";
		}
		case "INVALID_WORKSPACE": {
			return `Invalid workspace declaration at ${error.path}.`;
		}
		case "FAILED_TO_READ_WORKSPACE": {
			return `Failed to read the workspace declaration: ${stringifyError(error.error)}`;
		}
		case "INVALID_JSON": {
			return `Failed to parse a package configuration: ${stringifyError(error.cause)}`;
		}
		case "INVALID_PACKAGE_CONFIG": {
			return `Invalid package configuration:\n${error.issues
				.map((issue) => `  • ${issue.message}`)
				.join("\n")}`;
		}
		case "INVALID_VARIANTS": {
			return `Package ${error.packagePath} references unknown ${error.variantNames.length === 1 ? "variant" : "variants"}: ${error.variantNames.join(", ")}`;
		}
		case "VARIANT_CREATION_FAILED": {
			return `Failed to create ${error.variantNames.length === 1 ? "variant" : "variants"} ${error.variantNames.join(", ")} for package ${error.packagePath}: ${stringifyError(error.error)}`;
		}
		case "FAILED_TO_CREATE_GLOB_MATCHER": {
			return `Failed to create an ignore glob matcher: ${stringifyError(error.error)}`;
		}
		case "FAILED_TO_RUN_CHECK": {
			return `Failed to run a lint check: ${stringifyError(error.error)}`;
		}
		case "FAILED_TO_MERGE_VARIANT": {
			return `Failed to merge variant content: ${stringifyError(error.error)}`;
		}
		case "FAILED_TO_READ_FILE": {
			return `Failed to read a file: ${stringifyError(error.error)}`;
		}
		case "FAILED_FILE_EXISTENCE_CHECK": {
			return `Failed to check whether a file exists: ${stringifyError(error.error)}`;
		}
		case "AUTOFIX_FAILED": {
			return `Failed to run autofix at package ${error.packagePath}: ${stringifyError(error.error)}`;
		}
	}
};

export const formatLintError = (error: LintError | AutofixError): string =>
	styleText("red", formatLintErrorText(error));

const formatCreatePackageErrorText = (error: CreatePackageError): string => {
	switch (error.type) {
		case "CONFIG_NOT_FOUND": {
			return "Could not find a monoswan configuration.";
		}
		case "CONFIG_LOAD_FAILED": {
			return `Failed to load the monoswan configuration: ${stringifyError(error.cause)}`;
		}
		case "NO_DEFAULT_EXPORT": {
			return "The monoswan configuration must have a default export.";
		}
		case "INVALID_DEFAULT_EXPORT": {
			return "The default export is not a valid monoswan configuration.";
		}
		case "INVALID_VARIANTS": {
			return `Package ${error.packagePath} references unknown ${error.variantNames.length === 1 ? "variant" : "variants"}: ${error.variantNames.join(", ")}`;
		}
		case "VARIANT_CREATION_FAILED": {
			return `Failed to create ${error.variantNames.length === 1 ? "variant" : "variants"} ${error.variantNames.join(", ")} for package ${error.packagePath}: ${stringifyError(error.error)}`;
		}
		case "FAILED_TO_MERGE_VARIANT": {
			return `Failed to merge variant content: ${stringifyError(error.error)}`;
		}
		case "FAILED_FILE_EXISTENCE_CHECK": {
			return `Failed to check whether the package exists: ${stringifyError(error.error)}`;
		}
		case "PACKAGE_ALREADY_EXISTS": {
			return `A file or directory already exists at ${error.path}.`;
		}
		case "INVALID_INITIALIZER_PATH": {
			return `Initializer path must stay within the package: ${error.path}`;
		}
		case "CREATE_PACKAGE_FAILED": {
			return `Failed to create the package: ${stringifyError(error.error)}`;
		}
	}
};

export const formatCreatePackageError = (error: CreatePackageError): string =>
	styleText("red", formatCreatePackageErrorText(error));

const formatPrintConfigErrorText = (error: PrintConfigError): string => {
	switch (error.type) {
		case "CONFIG_NOT_FOUND": {
			return "Could not find a monoswan configuration.";
		}
		case "CONFIG_LOAD_FAILED": {
			return `Failed to load the monoswan configuration: ${stringifyError(error.cause)}`;
		}
		case "NO_DEFAULT_EXPORT": {
			return "The monoswan configuration must have a default export.";
		}
		case "INVALID_DEFAULT_EXPORT": {
			return "The default export is not a valid monoswan configuration.";
		}
		case "FAILED_FILE_EXISTENCE_CHECK": {
			return `Failed to check whether a file exists: ${stringifyError(error.error)}`;
		}
		case "FIND_PACKAGES_FAILED": {
			return `Failed to find workspace packages: ${stringifyError(error.error)}`;
		}
		case "WORKSPACE_NOT_FOUND": {
			return "Could not find a workspace declaration.";
		}
		case "INVALID_WORKSPACE": {
			return `Invalid workspace declaration at ${error.path}.`;
		}
		case "FAILED_TO_READ_WORKSPACE": {
			return `Failed to read the workspace declaration: ${stringifyError(error.error)}`;
		}
		case "PACKAGE_NOT_FOUND": {
			return `Could not find a workspace package containing ${error.path}.`;
		}
		case "FAILED_TO_READ_FILE": {
			return `Failed to read a package configuration: ${stringifyError(error.error)}`;
		}
		case "INVALID_JSON": {
			return `Failed to parse a package configuration: ${stringifyError(error.cause)}`;
		}
		case "INVALID_PACKAGE_CONFIG": {
			return `Invalid package configuration:\n${error.issues
				.map((issue) => `  • ${issue.message}`)
				.join("\n")}`;
		}
		case "INVALID_VARIANTS": {
			return `Package ${error.packagePath} references unknown ${error.variantNames.length === 1 ? "variant" : "variants"}: ${error.variantNames.join(", ")}`;
		}
		case "VARIANT_CREATION_FAILED": {
			return `Failed to create ${error.variantNames.length === 1 ? "variant" : "variants"} ${error.variantNames.join(", ")} for package ${error.packagePath}: ${stringifyError(error.error)}`;
		}
		case "FAILED_TO_MERGE_VARIANT": {
			return `Failed to merge variant content: ${stringifyError(error.error)}`;
		}
	}
};

export const formatPrintConfigError = (error: PrintConfigError): string =>
	styleText("red", formatPrintConfigErrorText(error));
