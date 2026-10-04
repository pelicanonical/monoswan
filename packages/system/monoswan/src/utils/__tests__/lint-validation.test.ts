import { createTestPackage, type TestPackage } from "@monoswan/testing-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LintRuleContext } from "../../types/rule.ts";
import { validateJson, validateJsonFile, validateTextFile } from "../lint-validation.ts";

let project: TestPackage;
let packageContext: LintRuleContext;

beforeEach(async () => {
	project = await createTestPackage({ name: "example" });
	packageContext = {
		packageName: "example",
		packagePath: project.rootPath,
		packageJson: { name: "example" },
		variant: {},
	};
});

afterEach(async () => {
	await project.cleanup();
});

describe("validateJson", () => {
	it("accepts an expected subset of an object", () => {
		expect(
			validateJson(
				{ scripts: { build: "tsc", test: "vitest" }, private: true },
				{ scripts: { build: "tsc" } },
				project.packageJsonPath,
				packageContext,
			),
		).toEqual([]);
	});

	it("reports leaf mismatches with paths and context", () => {
		const errors = validateJson(
			{ scripts: { build: "old", test: "old" } },
			{ scripts: { build: "new", test: "new" } },
			project.packageJsonPath,
			packageContext,
		);

		expect(errors).toHaveLength(2);
		expect(errors.map(({ locator }) => locator)).toEqual([
			{ type: "json", locator: ["scripts", "build"] },
			{ type: "json", locator: ["scripts", "test"] },
		]);
		expect(errors[0]).toMatchObject({
			filePath: project.packageJsonPath,
			packageContext,
		});
		expect(errors[0]?.message).toContain("scripts.build does not match variant");
	});

	it("describes a root-level mismatch as the document", () => {
		const [error] = validateJson("actual", "expected", project.packageJsonPath, packageContext);

		expect(error?.message).toContain("the document does not match variant");
		expect(error?.locator).toEqual({ type: "json", locator: [] });
	});
});

describe("validateJsonFile", () => {
	it("validates parsed JSON files", async () => {
		await project.writeJson("config.json", { enabled: true, extra: true });

		const result = await validateJsonFile(
			project.resolvePath("config.json"),
			{ enabled: true },
			packageContext,
		);

		expect(result.isOk).toBe(true);
		if (result.isOk) expect(result.value).toEqual([]);
	});

	it("validates JSONC files with comments and trailing commas", async () => {
		await project.writeFile(
			"tsconfig.json",
			`{
				// Compiler configuration
				"compilerOptions": {
					"strict": true,
				},
			}`,
		);

		const result = await validateJsonFile(
			project.resolvePath("tsconfig.json"),
			{ compilerOptions: { strict: true } },
			packageContext,
		);

		expect(result.isOk).toBe(true);
		if (result.isOk) expect(result.value).toEqual([]);
	});

	it("reports a missing JSON file", async () => {
		const filePath = project.resolvePath("missing.json");
		const result = await validateJsonFile(filePath, { enabled: true }, packageContext);

		expect(result.isOk).toBe(true);
		if (result.isOk) {
			expect(result.value).toEqual([
				{
					message: "Expected file to exist",
					filePath,
					packageContext,
				},
			]);
		}
	});

	it("rejects invalid JSON with its parse error", async () => {
		const filePath = project.resolvePath("invalid.json");
		await project.writeFile("invalid.json", "not json");

		const result = await validateJsonFile(filePath, { enabled: true }, packageContext);

		expect(result.isErr).toBe(true);
		if (result.isErr) {
			expect(result.error).toMatchObject({
				type: "FAILED_TO_PARSE_JSON",
				error: expect.any(SyntaxError),
			});
		}
	});

	it("preserves file-read failures as task rejections", async () => {
		const result = await validateJsonFile(project.rootPath, { enabled: true }, packageContext);

		expect(result.isErr).toBe(true);
		if (result.isErr) expect(result.error).toMatchObject({ type: "FAILED_TO_READ_FILE" });
	});
});

describe("validateTextFile", () => {
	it("accepts matching text and reports mismatches", async () => {
		await project.writeFile("NOTICE", "actual");

		const matching = await validateTextFile(
			project.resolvePath("NOTICE"),
			"actual",
			packageContext,
		);
		const mismatching = await validateTextFile(
			project.resolvePath("NOTICE"),
			"expected",
			packageContext,
		);

		expect(matching.isOk).toBe(true);
		if (matching.isOk) expect(matching.value).toEqual([]);
		expect(mismatching.isOk).toBe(true);
		if (mismatching.isOk) {
			expect(mismatching.value).toEqual([
				{
					message: "File contents do not match the configured variant",
					filePath: project.resolvePath("NOTICE"),
					packageContext,
				},
			]);
		}
	});

	it("reports a missing text file", async () => {
		const result = await validateTextFile(
			project.resolvePath("NOTICE"),
			"expected",
			packageContext,
		);

		expect(result.isOk).toBe(true);
		if (result.isOk) expect(result.value[0]?.message).toBe("Expected file to exist");
	});
});
