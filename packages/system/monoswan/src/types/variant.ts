import type { TsConfigJson } from "get-tsconfig";
import type { PackageManifest, JsonObject } from "./utils.ts";

export const DEFAULT_VARIANT_CONTENT: VariantContent = {};

export interface VariantContent {
  /**
   * The variant configuration for package.json
   *
   * @example
   * {
   * 	"scripts": {
   *			"dev:build": "NODE_ENV=development tsdown",
   *			"build": "NODE_ENV=production tsdown",
   *			"check": "tsc --noEmit"
   *		},
   * }
   */
  packageJson?: PackageManifest;
  /**
   * The variant configuration for tsconfig.json. If defined in both `tsConfig` and `tsConfigs`, this definition takes precendence over `tsConfigs`
   *
   * @example
   * {
   * 		"noUnusedLocals": true
   * }
   */
  tsConfig?: TsConfigJson;
  /**
   * The variant configuration for custom tsconfig paths keyed by the relative path from the package root.
   *
   *
   * @example
   * {
   * 	"tsconfig.json": {
   * 		"noUnusedLocals": true
   * 	},
   * 	"tsconfig.app.json": {
   * 		"noUnusedLocals": true
   * 	},
   * }
   */
  tsConfigs?: Record<string, TsConfigJson>;
  additionalJsonFiles?: Record<string, JsonObject>;
  additionalTextFiles?: Record<string, string>;
}

export interface VariantConfig extends VariantContent {
  initialization?: VariantContent;
}
