import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { PackageContext } from "../../types/context.ts";
import type { VariantConfig } from "../../types/variant.ts";
import { defaultJsonMerge, defaultTextMerge, mergeVariants } from "../merge.ts";

const packageContext: PackageContext = {
	packageName: "example",
	packagePath: "/repo/packages/example",
};

describe("default merge functions", () => {
	it("deeply merges JSON objects in declaration order", () => {
		expect(
			defaultJsonMerge([
				{ compilerOptions: { strict: false, target: "ES2024" } },
				{ compilerOptions: { strict: true } },
			]),
		).toEqual({ compilerOptions: { strict: true, target: "ES2024" } });
	});

	it("uses the last text value", () => {
		expect(defaultTextMerge(["first", "second"])).toBe("second");
		expect(defaultTextMerge(["only"])).toBe("only");
	});
});

describe("mergeVariants", () => {
	it("merges every variant content type, including initialization", () => {
		const variants: VariantConfig[] = [
			{
				packageJson: { scripts: { build: "tsc" } },
				tsConfig: { compilerOptions: { strict: false, target: "ES2024" } },
				tsConfigs: { "tsconfig.build.json": { compilerOptions: { declaration: false } } },
				additionalJsonFiles: { "config.json": { nested: { first: true } } },
				additionalTextFiles: { NOTICE: "first" },
				initialization: { additionalTextFiles: { README: "first" } },
			},
			{
				packageJson: { scripts: { test: "vitest" } },
				tsConfig: { compilerOptions: { strict: true } },
				tsConfigs: { "tsconfig.build.json": { compilerOptions: { declaration: true } } },
				additionalJsonFiles: { "config.json": { nested: { second: true } } },
				additionalTextFiles: { NOTICE: "second" },
				initialization: { additionalTextFiles: { README: "second" } },
			},
		];

		const result = mergeVariants(variants, undefined, packageContext);

		expect(result.isOk).toBe(true);
		if (result.isErr) return;
		expect(result.value).toEqual({
			packageJson: { scripts: { build: "tsc", test: "vitest" } },
			tsConfig: { compilerOptions: { strict: true, target: "ES2024" } },
			tsConfigs: { "tsconfig.build.json": { compilerOptions: { declaration: true } } },
			additionalJsonFiles: {
				"config.json": { nested: { first: true, second: true } },
			},
			additionalTextFiles: { NOTICE: "second" },
			initialization: {
				packageJson: { scripts: { build: "tsc", test: "vitest" } },
				tsConfig: { compilerOptions: { strict: true, target: "ES2024" } },
				tsConfigs: {
					"tsconfig.build.json": { compilerOptions: { declaration: true } },
				},
				additionalJsonFiles: {
					"config.json": { nested: { first: true, second: true } },
				},
				additionalTextFiles: { NOTICE: "second", README: "second" },
			},
		});
	});

	it("returns undefined content when no variants provide it", () => {
		const result = mergeVariants([], undefined, packageContext);

		expect(result.isOk).toBe(true);
		if (result.isErr) return;
		expect(result.value).toEqual({
			packageJson: undefined,
			tsConfig: undefined,
			tsConfigs: undefined,
			additionalJsonFiles: undefined,
			additionalTextFiles: undefined,
			initialization: {
				packageJson: undefined,
				tsConfig: undefined,
				tsConfigs: undefined,
				additionalJsonFiles: undefined,
				additionalTextFiles: undefined,
			},
		});
	});

	it("passes file context to custom merge functions", () => {
		const mergeText = vi.fn((values: [string, ...string[]]) => values.join("+"));
		const result = mergeVariants(
			[
				{ additionalTextFiles: { "docs/NOTICE": "one" } },
				{ additionalTextFiles: { "docs/NOTICE": "two" } },
			],
			{ mergeAdditionalTextFiles: mergeText },
			packageContext,
		);

		expect(result.isOk).toBe(true);
		if (result.isErr) return;
		expect(result.value.additionalTextFiles).toEqual({ "docs/NOTICE": "one+two" });
		expect(mergeText).toHaveBeenCalledWith(["one", "two"], {
			...packageContext,
			filePath: path.join(packageContext.packagePath, "docs/NOTICE"),
		});
	});

	it.each([
		[
			"package manifests",
			[{ packageJson: { private: true } }],
			{
				mergePackageManifests: () => {
					throw new Error("package manifest merge failed");
				},
			},
			"package manifest merge failed",
		],
		[
			"TypeScript configs",
			[{ tsConfig: { compilerOptions: { strict: true } } }],
			{
				mergeTsConfigs: () => {
					throw new Error("TypeScript config merge failed");
				},
			},
			"TypeScript config merge failed",
		],
		[
			"additional JSON files",
			[{ additionalJsonFiles: { "config.json": { enabled: true } } }],
			{
				mergeAdditionalJsonFiles: () => {
					throw new Error("JSON merge failed");
				},
			},
			"JSON merge failed",
		],
		[
			"additional text files",
			[{ additionalTextFiles: { NOTICE: "content" } }],
			{
				mergeAdditionalTextFiles: () => {
					throw new Error("text merge failed");
				},
			},
			"text merge failed",
		],
	] as const)(
		"maps thrown errors from %s to a typed error",
		(_name, variants, mergeFns, message) => {
			const result = mergeVariants([...variants], mergeFns, packageContext);

			expect(result.isErr).toBe(true);
			if (result.isOk) return;
			expect(result.error).toMatchObject({
				type: "FAILED_TO_MERGE_VARIANT",
				error: expect.objectContaining({ message }),
			});
		},
	);

	it("maps errors thrown while merging initialization content", () => {
		const error = new Error("initialization merge failed");
		let callCount = 0;
		const result = mergeVariants(
			[{ packageJson: { private: true }, initialization: { packageJson: { version: "0.0.0" } } }],
			{
				mergePackageManifests: (values) => {
					callCount += 1;
					if (callCount === 2) throw error;
					return values[0];
				},
			},
			packageContext,
		);

		expect(result.isErr).toBe(true);
		if (result.isOk) return;
		expect(result.error).toEqual({ type: "FAILED_TO_MERGE_VARIANT", error });
	});
});
