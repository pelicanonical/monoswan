import type { JsonPointer, PackageManifest } from "./utils.ts";
import type { PackageContext } from "./context.ts";
import type { VariantConfig } from "./variant.ts";
import type { IgnoredConfig } from "./root-config.ts";

type Locator =
  | {
      type: "json";
      locator: JsonPointer;
    }
  | { type: "text"; locator: { line: number; column?: number } };

type Autofix = (autoFixContext: LintRuleContext) => Promise<void>;

export interface LintRuleError {
  message: string;
  filePath: string;
  locator?: Locator;
  packageContext: LintRuleContext;
  autofix?: Autofix;
}

export interface LintRuleContext extends PackageContext {
  variant: VariantConfig;
  packageJson: PackageManifest;
}

export interface LintRule {
  name: string;
  ignore?: IgnoredConfig;
  check: (context: LintRuleContext) => Promise<LintRuleError[]> | LintRuleError[];
}
