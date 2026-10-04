import path from "node:path";
import { Result, Task } from "true-myth";
import { all as allResults } from "true-myth/result";
import { fromResult } from "true-myth/task";
import type { PackageManifest } from "./types/utils.ts";
import { DEFAULT_VARIANT_CONTENT, type VariantContent } from "./types/variant.ts";
import { loadMonoswanConfig, type LoadMonoswanConfigError } from "./loader.ts";
import { findMonoswanConfig } from "./utils.ts";
import { stringifyJsonFormatted } from "./utils/json.ts";
import {
	resolvePackageVariants,
	type InvalidVariantsError,
	type VariantCreationFailedError,
} from "./utils/variants.ts";
import { asMonoswanConfig } from "./types/package-config.ts";
import {
	createDirectory,
	doesFileExist,
	writeFileContents,
	type DoesFileExistError,
} from "./utils/file.ts";
import { isNotNil } from "es-toolkit";
import type { FailedToMergeVariantError } from "./utils/merge.ts";

export type CreatePackageError =
	| { type: "CONFIG_NOT_FOUND" }
	| LoadMonoswanConfigError
	| InvalidVariantsError
	| VariantCreationFailedError
	| FailedToMergeVariantError
	| DoesFileExistError
	| { type: "PACKAGE_ALREADY_EXISTS"; path: string }
	| { type: "INVALID_INITIALIZER_PATH"; path: string }
	| { type: "CREATE_PACKAGE_FAILED"; error: unknown };

export type PackageConfigLocation = "package-json" | "standalone";

export const createPackageFromVariants = (
	packagePath: string,
	packageName: string,
	variantNames: string[],
	configLocation: PackageConfigLocation = "package-json",
): Task<void, CreatePackageError> => {
	const absolutePackagePath = path.resolve(packagePath);
	const packageContext = { packageName, packagePath: absolutePackagePath };

	return fromResult(
		doesFileExist(absolutePackagePath).andThen((packageExists) =>
			packageExists
				? Result.err({ type: "PACKAGE_ALREADY_EXISTS", path: absolutePackagePath } as const)
				: findMonoswanConfig(absolutePackagePath),
		),
	)
		.andThen(loadMonoswanConfig)
		.andThen((config) =>
			fromResult(
				resolvePackageVariants(variantNames, config, packageContext).andThen(
					({ initialization = DEFAULT_VARIANT_CONTENT }) =>
						getPackageFiles(
							absolutePackagePath,
							packageName,
							variantNames,
							configLocation,
							initialization,
						),
				),
			),
		)
		.andThen(writePackageFiles);
};

const getPackageFiles = (
	packagePath: string,
	packageName: string,
	variantNames: string[],
	configLocation: PackageConfigLocation,
	initialization: VariantContent,
): Result<Map<string, string>, { type: "INVALID_INITIALIZER_PATH"; path: string }> => {
	const packageConfig = asMonoswanConfig({ variants: variantNames });
	const initializerManifest: PackageManifest & { monoswan?: unknown } = {
		...initialization.packageJson,
	};
	delete initializerManifest.monoswan;
	const manifest: PackageManifest = {
		...initializerManifest,
		name: packageName,
		...(configLocation === "package-json" ? { monoswan: packageConfig } : {}),
	};
	const files: Array<readonly [string, string]> = [
		...Object.entries(initialization.additionalTextFiles ?? {}),
		...Object.entries({ ...initialization.additionalJsonFiles, ...initialization.tsConfigs }).map(
			([filePath, contents]) => [filePath, stringifyJsonFormatted(contents)] as const,
		),
		initialization.tsConfig == null
			? undefined
			: (["tsconfig.json", stringifyJsonFormatted(initialization.tsConfig)] as const),
		configLocation === "standalone"
			? (["monoswan.json", stringifyJsonFormatted(packageConfig)] as const)
			: undefined,
		["package.json", stringifyJsonFormatted(manifest)] as const,
	].filter(isNotNil);

	return allResults(
		files.map(([relativePath, contents]) =>
			resolveInitializerPath(packagePath, relativePath).map(
				(filePath) => [filePath, contents] as const,
			),
		),
	).map((resolvedFiles) => new Map(resolvedFiles));
};

const resolveInitializerPath = (
	packagePath: string,
	relativePath: string,
): Result<string, { type: "INVALID_INITIALIZER_PATH"; path: string }> => {
	const filePath = path.resolve(packagePath, relativePath);
	return isWithinPackage(packagePath, filePath)
		? Result.ok(filePath)
		: Result.err({ type: "INVALID_INITIALIZER_PATH", path: relativePath });
};

const isWithinPackage = (packagePath: string, filePath: string) => {
	const relativePath = path.relative(packagePath, filePath);
	return (
		relativePath !== "" &&
		!relativePath.startsWith(`..${path.sep}`) &&
		!path.isAbsolute(relativePath)
	);
};

const writePackageFiles = (files: Map<string, string>) =>
	[...files].reduce<Task<void, { type: "CREATE_PACKAGE_FAILED"; error: unknown }>>(
		(task, [filePath, contents]) =>
			task.andThen(() =>
				createDirectory(path.dirname(filePath))
					.andThen(() => writeFileContents(filePath, contents))
					.mapRejected((error) => ({ type: "CREATE_PACKAGE_FAILED", error }) as const),
			),
		Task.resolve(undefined),
	);
