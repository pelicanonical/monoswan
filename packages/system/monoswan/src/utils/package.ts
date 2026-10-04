import { parserFor, type StandardSchemaV1 } from "true-myth/standard-schema";
import {
  PackageConfigSchema,
  RELATIVE_PACKAGE_CONFIG_PATH,
  type PackageConfig,
} from "../types/package-config.ts";
import { Result } from "true-myth";
import type { Project } from "@pnpm/workspace.projects-reader";
import path from "node:path";
import type Task from "true-myth/task";
import { fromResult } from "true-myth/task";
import type { PackageContext, PackageManifestContext } from "../types/context.ts";
import type { PackageManifest } from "../types/utils.ts";
import {
  doesFileExist,
  readFileContents,
  type DoesFileExistError,
  type ReadFileContentsError,
} from "./file.ts";
import { parseJson } from "./parse.ts";

const parseManifestMonoswanConfig = parserFor(PackageConfigSchema);

export type PackageConfigError =
  | { type: "INVALID_JSON"; cause: unknown }
  | DoesFileExistError
  | ReadFileContentsError
  | {
      type: "INVALID_PACKAGE_CONFIG";
      issues: ReadonlyArray<StandardSchemaV1.Issue>;
    };

export const getPackageVariantNames = (config: PackageConfig | undefined): string[] => {
  if (config?.variants == null) {
    return [];
  }

  return Array.isArray(config.variants) ? config.variants : [config.variants];
};

export const loadPackageConfig = (pkg: {
  packagePath: string;
  packageJson: PackageManifest;
}): Task<PackageConfig | undefined, PackageConfigError> => {
  const packageConfigPath = path.join(pkg.packagePath, RELATIVE_PACKAGE_CONFIG_PATH);

  return fromResult(doesFileExist(packageConfigPath)).andThen((exists) =>
    exists
      ? getStandaloneConfig(packageConfigPath)
      : fromResult(getManifestConfig(pkg.packageJson)),
  );
};

const getStandaloneConfig = (packageDirectory: string) =>
  readFileContents(packageDirectory)
    .andThen((contents) =>
      fromResult(
        parseJson(contents).mapErr(
          ({ error }) => ({ type: "INVALID_JSON", cause: error }) as const,
        ),
      ),
    )
    .map(parsePackageConfig)
    .andThen(fromResult);

const getManifestConfig = (manifest: {
  name?: string;
}): Result<PackageConfig | undefined, PackageConfigError> => {
  const { monoswan } = manifest as {
    monoswan?: unknown;
  };

  if (monoswan == null) {
    return Result.ok(undefined);
  }

  return parsePackageConfig(monoswan);
};

const parsePackageConfig = (config: unknown): Result<PackageConfig, PackageConfigError> =>
  parseManifestMonoswanConfig(config).mapErr(
    (error) =>
      ({
        type: "INVALID_PACKAGE_CONFIG",
        issues: error.issues,
      }) as const,
  );

export const getPackageContext = (pkg: Project): PackageManifestContext => ({
  packageName: pkg.manifest.name,
  packagePath: pkg.rootDir,
  packageJson: pkg.manifest,
});

export const getPackageName = (pkg: PackageContext): string => pkg.packageName ?? pkg.packagePath;
