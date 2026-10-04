import { Task } from "true-myth";
import { tryOrElse } from "true-myth/task";
import type { LintRuleError } from "./types/rule.ts";
import type { PackageManifest } from "./types/utils.ts";
import { readProjectManifestOnly } from "@pnpm/workspace.project-manifest-reader";

export interface AutofixError {
	type: "AUTOFIX_FAILED";
	packagePath: string;
	error: unknown;
}

const getAutofixError = (packagePath: string, error: unknown): AutofixError => ({
	type: "AUTOFIX_FAILED",
	packagePath,
	error,
});

const reloadPackageJson = (packagePath: string): Task<PackageManifest, AutofixError> =>
	tryOrElse(
		(error) => getAutofixError(packagePath, error),
		() => readProjectManifestOnly(packagePath),
	);

const runAutofix = (
	error: LintRuleError & {
		autofix: NonNullable<LintRuleError["autofix"]>;
	},
): Task<void, AutofixError> =>
	reloadPackageJson(error.packageContext.packagePath).andThen((packageJson) =>
		tryOrElse(
			(cause) => getAutofixError(error.packageContext.packagePath, cause),
			() =>
				error.autofix({
					...error.packageContext,
					packageJson,
				}),
		),
	);

export const autofixAll = (errors: LintRuleError[]): Task<void, AutofixError> =>
	errors.reduce<Task<void, AutofixError>>(
		(task, error) =>
			task.andThen(() =>
				doesErrorHaveAutofix(error) ? runAutofix(error) : Task.resolve(undefined),
			),
		Task.resolve(undefined),
	);

const doesErrorHaveAutofix = (
	error: LintRuleError,
): error is LintRuleError & {
	autofix: NonNullable<LintRuleError["autofix"]>;
} => error.autofix != null;
