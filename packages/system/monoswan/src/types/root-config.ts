import { type TsConfigJson } from "get-tsconfig";
import type { LintRule } from "./rule.ts";
import type { VariantConfig } from "./variant.ts";
import type { MONOSWAN_CONFIG_DISCRIMINATOR } from "../utils.ts";
import type { JsonObject, PackageManifest } from "./utils.ts";
import type { FileContext, PackageContext } from "./context.ts";

export type MergeFn<Schema> = (schemas: [Schema, ...Schema[]], context: FileContext) => Schema;

export interface IgnoredConfig {
  packages?: string[];
  paths?: string[];
}

export interface MonoswanConfig {
  type: typeof MONOSWAN_CONFIG_DISCRIMINATOR;
  variants?: Record<string, VariantConfig | ((context: PackageContext) => VariantConfig)>;
  merge?: {
    mergePackageManifests?: MergeFn<PackageManifest>;
    mergeTsConfigs?: MergeFn<TsConfigJson>;
    mergeAdditionalJsonFiles?: MergeFn<JsonObject>;
    mergeAdditionalTextFiles?: MergeFn<string>;
  };
  rules?: LintRule[];
  /**
   * Packages matched by this configuration will be ignored for all rules
   */
  ignore?: IgnoredConfig;
}
