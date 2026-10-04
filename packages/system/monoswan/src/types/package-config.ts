import * as v from "valibot";
import { getMonoswanStandalonePackageConfigPath } from "../utils/paths.ts";
import { stringifyJsonFormatted } from "../utils/json.ts";
import type { IgnoredConfig } from "./root-config.ts";
import { writeFileContents } from "../utils/file.ts";

const VariantSchema = v.optional(v.array(v.string()));

export const RELATIVE_PACKAGE_CONFIG_PATH = "monoswan.json";

export const PackageConfigSchema = v.object({
  variants: VariantSchema,
});

export type PackageConfig = v.InferOutput<typeof PackageConfigSchema>;

export const DEFAULT_IGNORE_CONFIG: IgnoredConfig = {
  packages: [],
  paths: [],
};

export const DEFAULT_CONFIG: PackageConfig = {
  variants: [],
};

export const asMonoswanConfig = (config: PackageConfig) => config;

export const writeMonoswanStandalonePackageConfig = async (
  packagePath: string,
  config: PackageConfig,
): Promise<void> => {
  const result = await writeFileContents(
    getMonoswanStandalonePackageConfigPath(packagePath),
    stringifyJsonFormatted(config),
  );

  if (result.isErr) {
    throw result.error;
  }
};
