import type { IgnoredConfig } from "../types/root-config.ts";
import type { LintRule } from "../types/rule.ts";
import type { PackageManifestContext } from "../types/context.ts";
import { all as allResults } from "true-myth/result";
import { fromResult } from "true-myth/task";
import { createGlobMatcher } from "./glob.ts";
import { isPackageIgnored } from "./repo.ts";

export type CreateLintRuleOptions = Pick<LintRule, "name" | "check">;

export interface MonoswanRuleOptions {
	ignore?: IgnoredConfig;
}

export const createIgnoreMatchers = (ignore: IgnoredConfig = {}) =>
	allResults([createGlobMatcher(ignore.paths ?? []), createGlobMatcher(ignore.packages ?? [])]);

export const getRulesByPackage = (
	packages: PackageManifestContext[],
	rules: LintRule[],
	repoPath: string,
) =>
	fromResult(
		allResults(
			rules.map((rule) =>
				createIgnoreMatchers(rule.ignore).map(([isIgnoredPath, isIgnoredPackage]) => ({
					rule,
					isIgnoredPath,
					isIgnoredPackage,
				})),
			),
		),
	).map(
		(rulesWithMatchers) =>
			new Map(
				packages.map((pkg) => [
					pkg,
					rulesWithMatchers
						.filter(
							({ isIgnoredPath, isIgnoredPackage }) =>
								!isPackageIgnored(pkg, repoPath, isIgnoredPath, isIgnoredPackage),
						)
						.map(({ rule }) => rule),
				]),
			),
	);

export function createRule(
	createRuleFn: () => CreateLintRuleOptions,
): (options?: undefined, monoswanOptions?: MonoswanRuleOptions) => LintRule;

export function createRule<RuleOptions>(
	createRuleFn: (options?: RuleOptions) => CreateLintRuleOptions,
): (options?: RuleOptions, monoswanOptions?: MonoswanRuleOptions) => LintRule;

export function createRule<RuleOptions>(
	createRuleFn: (options: RuleOptions) => CreateLintRuleOptions,
): (options: RuleOptions, monoswanOptions?: MonoswanRuleOptions) => LintRule;

export function createRule<RuleOptions>(
	createRuleFn: (options: RuleOptions) => CreateLintRuleOptions,
) {
	return (options: RuleOptions, monoswanOptions?: MonoswanRuleOptions): LintRule => ({
		...createRuleFn(options),
		ignore: monoswanOptions?.ignore,
	});
}
