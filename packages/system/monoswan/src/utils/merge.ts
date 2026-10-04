import { isNotNil, merge } from "es-toolkit";
import type { TsConfigJson } from "get-tsconfig";
import path from "node:path";
import { Result } from "true-myth";
import { all as allResults, tryOrElse } from "true-myth/result";
import type { MonoswanConfig } from "../config.ts";
import type { FileContext, PackageContext } from "../types/context.ts";
import type { JsonObject } from "../types/utils.ts";
import type { VariantConfig, VariantContent } from "../types/variant.ts";
import { isAtLeastOneArray, type AtLeastOneArray } from "./arrays.ts";
import { getPackageJsonPath, getTsconfigPath } from "./paths.ts";

type MergeConfig = MonoswanConfig["merge"];

export interface FailedToMergeVariantError {
  type: "FAILED_TO_MERGE_VARIANT";
  error: unknown;
}

export const defaultJsonMerge = <T extends object>(schemas: AtLeastOneArray<T>): T => {
  return schemas.slice(1).reduce((prev, curr) => merge(prev, curr), schemas[0]);
};

export const defaultTextMerge = (schemas: AtLeastOneArray<string>): string => {
  return schemas.at(-1) ?? schemas[0];
};

const mergeOptional = <T>(
  values: Array<T | undefined>,
  mergeFn: (values: AtLeastOneArray<T>, context: FileContext) => T,
  context: FileContext,
): Result<T | undefined, FailedToMergeVariantError> => {
  const definedValues = values.filter(isNotNil);

  return isAtLeastOneArray(definedValues)
    ? tryOrElse(
        (error): FailedToMergeVariantError => ({ type: "FAILED_TO_MERGE_VARIANT", error }),
        () => mergeFn(structuredClone(definedValues), context),
      )
    : Result.ok(undefined);
};

const mergeMultifileConfig = <T>(
  records: Array<Record<string, T> | undefined>,
  mergeFn: (values: AtLeastOneArray<T>, context: FileContext) => T,
  packageContext: PackageContext,
): Result<Record<string, T> | undefined, FailedToMergeVariantError> => {
  const filePaths = new Set(records.flatMap((record) => Object.keys(record ?? {})));

  if (filePaths.size === 0) {
    return Result.ok(undefined);
  }

  return allResults(
    Array.from(
      filePaths,
      (filePath): Result<[string, T] | undefined, FailedToMergeVariantError> => {
        const schemas = records.map((record) => record?.[filePath]).filter(isNotNil);

        if (!isAtLeastOneArray(schemas)) {
          return Result.ok(undefined);
        }

        return tryOrElse(
          (error): FailedToMergeVariantError => ({ type: "FAILED_TO_MERGE_VARIANT", error }),
          () => [
            filePath,
            mergeFn(structuredClone(schemas), {
              ...packageContext,
              filePath: path.join(packageContext.packagePath, filePath),
            }),
          ],
        );
      },
    ),
  ).map((entries) => Object.fromEntries(entries.filter(isNotNil)));
};

const mergeVariantContent = (
  contents: VariantContent[],
  mergeFns: MergeConfig,
  packageContext: PackageContext,
): Result<VariantContent, FailedToMergeVariantError> => {
  const mergePackageManifests = mergeFns?.mergePackageManifests ?? defaultJsonMerge;
  const mergeTsConfigs = mergeFns?.mergeTsConfigs ?? defaultJsonMerge;
  const mergeAdditionalJsonFiles = mergeFns?.mergeAdditionalJsonFiles ?? defaultJsonMerge;
  const mergeAdditionalTextFiles = mergeFns?.mergeAdditionalTextFiles ?? defaultTextMerge;

  return allResults([
    mergeOptional(
      contents.map(({ packageJson }) => packageJson),
      mergePackageManifests,
      {
        ...packageContext,
        filePath: getPackageJsonPath(packageContext.packagePath),
      },
    ),
    mergeOptional(
      contents.map(({ tsConfig }) => tsConfig),
      mergeTsConfigs,
      {
        ...packageContext,
        filePath: getTsconfigPath(packageContext.packagePath),
      },
    ),
    mergeMultifileConfig<TsConfigJson>(
      contents.map(({ tsConfigs }) => tsConfigs),
      mergeTsConfigs,
      packageContext,
    ),
    mergeMultifileConfig<JsonObject>(
      contents.map(({ additionalJsonFiles }) => additionalJsonFiles),
      mergeAdditionalJsonFiles,
      packageContext,
    ),
    mergeMultifileConfig<string>(
      contents.map(({ additionalTextFiles }) => additionalTextFiles),
      mergeAdditionalTextFiles,
      packageContext,
    ),
  ]).map(([packageJson, tsConfig, tsConfigs, additionalJsonFiles, additionalTextFiles]) => ({
    packageJson,
    tsConfig,
    tsConfigs,
    additionalJsonFiles,
    additionalTextFiles,
  }));
};

export const mergeVariants = (
  variants: VariantConfig[],
  mergeFns: MonoswanConfig["merge"],
  packageContext: PackageContext,
): Result<VariantConfig, FailedToMergeVariantError> =>
  mergeVariantContent(variants, mergeFns, packageContext).andThen((content) =>
    mergeVariantContent(
      variants.flatMap(({ initialization, ...config }) =>
        initialization == null ? [config] : [config, initialization],
      ),
      mergeFns,
      packageContext,
    ).map((initialization) => ({ ...content, initialization })),
  );
