import { createTestPackage, type TestPackage } from "@monoswan/testing-utils";
import { mkdir } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LintRuleContext } from "../../types/rule.ts";
import { enforceVariants, requireMonoswanConfig } from "../variant-rules.ts";

let project: TestPackage;

beforeEach(async () => {
	project = await createTestPackage({ name: "example", prefix: "monoswan-variant-rules-" });
});

afterEach(async () => {
	await project.cleanup();
});

const getContext = (
	options: Pick<LintRuleContext, "packageJson" | "variant">,
): LintRuleContext => ({
	packageName: "example",
	packagePath: project.rootPath,
	...options,
});

describe("enforceVariants", () => {
	it("returns no errors when no variant content is configured", async () => {
		const rule = enforceVariants();
		const context = getContext({ packageJson: { name: "example" }, variant: {} });

		await expect(rule.check(context)).resolves.toEqual([]);
	});

	it("accepts matching package, TypeScript, JSON, and text content", async () => {
		await Promise.all([
			project.writeJson("tsconfig.json", {
				compilerOptions: { strict: true },
				unrelated: true,
			}),
			project.writeJson("config/tsconfig.build.json", {
				compilerOptions: { declaration: true },
			}),
			project.writeJson("config/metadata.json", {
				enabled: true,
				unrelated: true,
			}),
			project.writeFile("NOTICE", "generated\n"),
		]);
		const context = getContext({
			packageJson: {
				name: "example",
				scripts: { build: "tsc", test: "vitest" },
			},
			variant: {
				packageJson: { scripts: { build: "tsc" } },
				tsConfig: { compilerOptions: { strict: true } },
				tsConfigs: {
					"config/tsconfig.build.json": { compilerOptions: { declaration: true } },
				},
				additionalJsonFiles: { "config/metadata.json": { enabled: true } },
				additionalTextFiles: { NOTICE: "generated\n" },
			},
		});

		await expect(enforceVariants().check(context)).resolves.toEqual([]);
	});

	it("aggregates mismatches with their file paths and locators", async () => {
		await Promise.all([
			project.writeJson("tsconfig.json", { compilerOptions: {} }),
			project.writeJson("metadata.json", { enabled: false }),
			project.writeFile("NOTICE", "unexpected\n"),
		]);
		const context = getContext({
			packageJson: { name: "example", scripts: { build: "old-command" } },
			variant: {
				packageJson: { scripts: { build: "new-command" } },
				tsConfig: { compilerOptions: { strict: true } },
				additionalJsonFiles: { "metadata.json": { enabled: true } },
				additionalTextFiles: { NOTICE: "expected\n" },
			},
		});

		const errors = await enforceVariants().check(context);

		expect(errors).toHaveLength(4);
		expect(errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					filePath: project.resolvePath("package.json"),
					locator: { type: "json", locator: ["scripts", "build"] },
				}),
				expect.objectContaining({
					filePath: project.resolvePath("tsconfig.json"),
					locator: { type: "json", locator: ["compilerOptions", "strict"] },
				}),
				expect.objectContaining({
					filePath: project.resolvePath("metadata.json"),
					locator: { type: "json", locator: ["enabled"] },
				}),
				expect.objectContaining({
					filePath: project.resolvePath("NOTICE"),
					message: "File contents do not match the configured variant",
				}),
			]),
		);
	});

	it("reports configured files that do not exist", async () => {
		const context = getContext({
			packageJson: { name: "example" },
			variant: {
				tsConfig: { compilerOptions: { strict: true } },
				tsConfigs: { "tsconfig.build.json": { compilerOptions: { declaration: true } } },
				additionalJsonFiles: { "metadata.json": { enabled: true } },
				additionalTextFiles: { NOTICE: "expected\n" },
			},
		});

		const errors = await enforceVariants().check(context);

		expect(errors).toHaveLength(4);
		expect(errors.every(({ message }) => message === "Expected file to exist")).toBe(true);
		expect(errors.map(({ filePath }) => filePath)).toEqual([
			project.resolvePath("tsconfig.json"),
			project.resolvePath("tsconfig.build.json"),
			project.resolvePath("metadata.json"),
			project.resolvePath("NOTICE"),
		]);
	});

	it("propagates failures encountered while reading configured files", async () => {
		await mkdir(project.resolvePath("NOTICE"));
		const context = getContext({
			packageJson: { name: "example" },
			variant: { additionalTextFiles: { NOTICE: "expected" } },
		});

		await expect(enforceVariants().check(context)).rejects.toBeInstanceOf(Error);
	});
});

describe("requireMonoswanConfig", () => {
	it("reports a missing config and provides an autofix", async () => {
		const context = getContext({ packageJson: { name: "example" }, variant: {} });
		const errors = await requireMonoswanConfig().check(context);

		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatchObject({
			message: "monoswan config is not defined for this package",
			filePath: project.rootPath,
			autofix: expect.any(Function),
		});

		await errors[0]?.autofix?.(context);
		await expect(project.readJson("monoswan.json")).resolves.toEqual({ variants: [] });
	});

	it("accepts a config without variants by default", async () => {
		await project.writeJson("monoswan.json", {});
		const context = getContext({
			packageJson: { name: "example" },
			variant: {},
		});

		await expect(requireMonoswanConfig().check(context)).resolves.toEqual([]);
	});

	it("reports an invalid config without offering a destructive autofix", async () => {
		await project.writeFile("monoswan.json", "not json");
		const context = getContext({ packageJson: { name: "example" }, variant: {} });

		const errors = await requireMonoswanConfig().check(context);

		expect(errors).toEqual([
			expect.objectContaining({
				message: "Failed to read and parse monoswan config for this package",
			}),
		]);
		expect(errors[0]?.autofix).toBeUndefined();
		await expect(project.readFile("monoswan.json")).resolves.toBe("not json");
	});

	it("requires a selected variant when configured", async () => {
		await project.writeJson("monoswan.json", { variants: [] });
		const withoutVariant = getContext({
			packageJson: { name: "example" },
			variant: {},
		});
		const withVariant = getContext({
			packageJson: { name: "example" },
			variant: {},
		});
		const rule = requireMonoswanConfig({ requireVariant: true });

		await expect(rule.check(withoutVariant)).resolves.toEqual([
			expect.objectContaining({
				message: "At least one variant must be defined for this package",
			}),
		]);
		await project.writeJson("monoswan.json", { variants: ["library"] });
		await expect(rule.check(withVariant)).resolves.toEqual([]);
	});
});
