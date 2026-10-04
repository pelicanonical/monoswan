import type { MonoswanConfig } from "./types/root-config.ts";
import { MONOSWAN_CONFIG_DISCRIMINATOR } from "./utils.ts";

export type { MonoswanConfig } from "./types/root-config.ts";

export type MonoswanConfigInput = Omit<MonoswanConfig, "type">;

export const defineConfig = (config: MonoswanConfigInput): MonoswanConfig => ({
  type: MONOSWAN_CONFIG_DISCRIMINATOR,
  ...config,
});

export * from "./rules/sort-rules.ts";
export * from "./rules/variant-rules.ts";
export { createRule } from "./utils/rule.ts";
export type { CreateLintRuleOptions, MonoswanRuleOptions } from "./utils/rule.ts";
export { DEFAULT_PACKAGE_JSON_SORT_OPTIONS } from "./rules/utils/sorting.ts";
