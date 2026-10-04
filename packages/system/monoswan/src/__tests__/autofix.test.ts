import { createTestPackage, type TestPackage } from "@monoswan/testing-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { autofixAll } from "../autofix.ts";
import type { LintRuleContext, LintRuleError } from "../types/rule.ts";
import { sortPackageJson } from "../rules/sort-rules.ts";

let project: TestPackage;

beforeEach(async () => {
	project = await createTestPackage({ name: "example" });
});

afterEach(async () => {
	await project.cleanup();
});

const getContext = (packageJson: LintRuleContext["packageJson"]): LintRuleContext => ({
	packageName: "example",
	packagePath: project.rootPath,
	packageJson,
	variant: {},
});

describe("autofixAll", () => {
	it("runs every autofix with a freshly loaded package manifest", async () => {
		const packageJson = {
			name: "example",
			dependencies: { beta: "2.0.0", alpha: "1.0.0" },
			scripts: { test: "vitest", build: "tsc" },
		};
		await project.writePackageJson(packageJson);
		const context = getContext(packageJson);
		const errors = [
			...(await sortPackageJson({
				order: "none",
				overrides: {
					dependencies: { order: "alphabetical" },
					scripts: { order: "alphabetical" },
				},
			}).check(context)),
		];

		const result = await autofixAll(errors);

		expect(result.isOk).toBe(true);
		const fixedPackageJson = await project.readJson<LintRuleContext["packageJson"]>("package.json");
		expect(Object.keys(fixedPackageJson.dependencies ?? {})).toEqual(["alpha", "beta"]);
		expect(Object.keys(fixedPackageJson.scripts ?? {})).toEqual(["build", "test"]);
	});

	it("skips errors without an autofix", async () => {
		const error: LintRuleError = {
			message: "not fixable",
			filePath: project.packageJsonPath,
			packageContext: getContext({ name: "example" }),
		};

		const result = await autofixAll([error]);

		expect(result.isOk).toBe(true);
	});

	it("runs autofixes sequentially", async () => {
		const calls: number[] = [];
		const context = getContext(await project.readPackageJson());
		const getError = (value: number): LintRuleError => ({
			message: `fix ${value}`,
			filePath: project.packageJsonPath,
			packageContext: context,
			autofix: async () => {
				await Promise.resolve();
				calls.push(value);
			},
		});

		const result = await autofixAll([getError(1), getError(2), getError(3)]);

		expect(result.isOk).toBe(true);
		expect(calls).toEqual([1, 2, 3]);
	});

	it("maps package reload failures and does not run the fix", async () => {
		await project.writeFile("package.json", "not json");
		const autofix = vi.fn(async () => {});
		const error: LintRuleError = {
			message: "fixable",
			filePath: project.packageJsonPath,
			packageContext: getContext({ name: "example" }),
			autofix,
		};

		const result = await autofixAll([error]);

		expect(result.isErr).toBe(true);
		if (result.isErr) {
			expect(result.error).toMatchObject({
				type: "AUTOFIX_FAILED",
				packagePath: project.rootPath,
			});
		}
		expect(autofix).not.toHaveBeenCalled();
	});

	it("maps autofix callback failures and stops subsequent fixes", async () => {
		const context = getContext(await project.readPackageJson());
		const laterAutofix = vi.fn(async () => {});
		const errors: LintRuleError[] = [
			{
				message: "fails",
				filePath: project.packageJsonPath,
				packageContext: context,
				autofix: async () => {
					throw new Error("cannot fix");
				},
			},
			{
				message: "later",
				filePath: project.packageJsonPath,
				packageContext: context,
				autofix: laterAutofix,
			},
		];

		const result = await autofixAll(errors);

		expect(result.isErr).toBe(true);
		if (result.isErr) {
			expect(result.error).toMatchObject({
				type: "AUTOFIX_FAILED",
				packagePath: project.rootPath,
				error: expect.any(Error),
			});
		}
		expect(laterAutofix).not.toHaveBeenCalled();
	});
});
