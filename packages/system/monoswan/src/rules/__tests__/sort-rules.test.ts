import { createTestPackage, type TestPackage } from "@monoswan/testing-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LintRuleContext } from "../../types/rule.ts";
import { sortPackageJson } from "../sort-rules.ts";

let project: TestPackage;

beforeEach(async () => {
	project = await createTestPackage({ name: "example", prefix: "monoswan-sort-rules-" });
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

describe("sortPackageDependencies", () => {
	it("defaults to alphabetical sorting when options are omitted", async () => {
		const rule = sortPackageJson();

		expect(
			await rule.check(getContext({ dependencies: { beta: "1.0.0", alpha: "1.0.0" } })),
		).toHaveLength(1);
	});

	it("uses the default package field order and alphabetizes configured arrays", async () => {
		const rule = sortPackageJson();
		const packageJson = {
			version: "1.0.0",
			name: "example",
			keywords: ["zebra", "alpha"],
		};
		const context = getContext(packageJson as unknown as LintRuleContext["packageJson"]);

		const errors = await rule.check(context);

		expect(errors.map(({ locator }) => locator)).toEqual([
			{ type: "json", locator: [] },
			{ type: "json", locator: ["keywords"] },
		]);
	});

	it("accepts duplicate values in sorted string arrays", async () => {
		const rule = sortPackageJson({
			order: "none",
			overrides: { keywords: { order: "alphabetical" } },
		});

		expect(await rule.check(getContext({ keywords: ["same", "same"] }))).toEqual([]);
	});

	it("ignores scalar values targeted by sorting overrides", async () => {
		const rule = sortPackageJson({
			order: "none",
			overrides: { private: { order: "alphabetical" } },
		});

		expect(await rule.check(getContext({ private: true }))).toEqual([]);
	});

	it("accepts alphabetically sorted dependency groups", async () => {
		const rule = sortPackageJson({ order: "none", children: { order: "alphabetical" } });
		const context = getContext({
			dependencies: { alpha: "1.0.0", beta: "1.0.0" },
			devDependencies: { alpha: "1.0.0", beta: "1.0.0" },
			peerDependencies: { alpha: "1.0.0", beta: "1.0.0" },
			optionalDependencies: { alpha: "1.0.0", beta: "1.0.0" },
		});

		expect(await rule.check(context)).toEqual([]);
	});

	it("reports each unsorted dependency group with its JSON locator", async () => {
		const rule = sortPackageJson({ order: "none", children: { order: "alphabetical" } });
		const context = getContext({
			dependencies: { beta: "1.0.0", alpha: "1.0.0" },
			devDependencies: { beta: "1.0.0", alpha: "1.0.0" },
			peerDependencies: { beta: "1.0.0", alpha: "1.0.0" },
			optionalDependencies: { beta: "1.0.0", alpha: "1.0.0" },
		});

		const errors = await rule.check(context);

		expect(errors).toHaveLength(4);
		expect(errors.map(({ locator }) => locator)).toEqual([
			{ type: "json", locator: ["dependencies"] },
			{ type: "json", locator: ["devDependencies"] },
			{ type: "json", locator: ["peerDependencies"] },
			{ type: "json", locator: ["optionalDependencies"] },
		]);
		expect(errors.every(({ filePath }) => filePath === project.resolvePath("package.json"))).toBe(
			true,
		);
	});

	it("uses a custom comparison function", async () => {
		const rule = sortPackageJson({
			order: "none",
			children: {
				order: "custom",
				compare: (left, right) => right.localeCompare(left),
			},
		});

		expect(
			await rule.check(getContext({ dependencies: { beta: "1.0.0", alpha: "1.0.0" } })),
		).toEqual([]);
		expect(
			await rule.check(getContext({ dependencies: { alpha: "1.0.0", beta: "1.0.0" } })),
		).toHaveLength(1);
	});

	it("autofixes only the reported dependency group", async () => {
		const rule = sortPackageJson({
			order: "none",
			overrides: { dependencies: { order: "alphabetical" } },
		});
		const context = getContext({
			name: "example",
			scripts: { test: "vitest" },
			dependencies: { beta: "2.0.0", alpha: "1.0.0" },
		});
		const [error] = await rule.check(context);

		expect(error?.autofix).toBeTypeOf("function");
		await error?.autofix?.(context);

		const written = await project.readJson<LintRuleContext["packageJson"]>("package.json");
		expect(Object.keys(written.dependencies ?? {})).toEqual(["alpha", "beta"]);
		expect(written.scripts).toEqual({ test: "vitest" });
	});

	it("does not write when the reported group is absent from the autofix context", async () => {
		const rule = sortPackageJson({
			order: "none",
			overrides: { dependencies: { order: "alphabetical" } },
		});
		const originalContext = getContext({
			dependencies: { beta: "2.0.0", alpha: "1.0.0" },
		});
		const [error] = await rule.check(originalContext);
		const autofixContext = getContext({ name: "example" });

		await error?.autofix?.(autofixContext);

		expect(await project.readPackageJson()).toMatchObject({ name: "example" });
	});

	it("uses fixed key order with an alphabetical fallback", async () => {
		const rule = sortPackageJson({
			order: "fixed",
			keys: ["name", "version"],
		});
		const packageJson = { version: "1.0.0", name: "example", zebra: true, alpha: true };
		const context = getContext(packageJson as unknown as LintRuleContext["packageJson"]);

		const [error] = await rule.check(context);

		expect(error?.locator).toEqual({ type: "json", locator: [] });
		await project.writePackageJson(packageJson);
		await error?.autofix?.(context);
		expect(Object.keys(await project.readPackageJson())).toEqual([
			"name",
			"version",
			"alpha",
			"zebra",
		]);
	});

	it("recursively sorts children and applies property overrides", async () => {
		const rule = sortPackageJson({
			order: "none",
			children: { order: "alphabetical" },
			overrides: {
				exports: {
					order: "alphabetical",
					children: { order: "fixed", keys: ["types", "import", "default"] },
				},
			},
		});
		const packageJson = {
			exports: {
				"./z": { default: "./z.js", types: "./z.d.ts", import: "./z.js" },
				"./a": { types: "./a.d.ts", import: "./a.js", default: "./a.js" },
			},
			dependencies: { zebra: "1.0.0", alpha: "1.0.0" },
		};
		const context = getContext(packageJson as unknown as LintRuleContext["packageJson"]);

		const errors = await rule.check(context);

		expect(errors.map(({ locator }) => locator)).toEqual([
			{ type: "json", locator: ["exports"] },
			{ type: "json", locator: ["exports", "./z"] },
			{ type: "json", locator: ["dependencies"] },
		]);
	});

	it("autofixes a deeply nested object without reordering its parents", async () => {
		const rule = sortPackageJson({
			order: "none",
			overrides: {
				exports: {
					order: "none",
					overrides: { ".": { order: "alphabetical" } },
				},
			},
		});
		const packageJson = {
			name: "example",
			exports: { ".": { types: "./index.d.ts", default: "./index.js" } },
		};
		const context = getContext(packageJson as unknown as LintRuleContext["packageJson"]);
		await project.writePackageJson(packageJson);

		const [error] = await rule.check(context);
		await error?.autofix?.(context);

		const written = await project.readPackageJson();
		expect(Object.keys(written)).toEqual(["name", "exports"]);
		expect(Object.keys((written.exports as Record<string, object>)["."] ?? {})).toEqual([
			"default",
			"types",
		]);
	});
});
