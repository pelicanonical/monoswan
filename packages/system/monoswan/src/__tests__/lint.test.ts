import {
	createTestMonorepo,
	type TestMonorepo,
	type TestWorkspaceOptions,
} from "@monoswan/testing-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lint } from "../lint.ts";

let monorepo: TestMonorepo;

beforeEach(async () => {
	monorepo = await createTestMonorepo({ name: "lint-fixture" });
});

afterEach(async () => {
	await monorepo.cleanup();
});

const writeConfig = (source: string) => monorepo.writeFile("monoswan.config.ts", source);

describe("lint", () => {
	it("loads the config, discovers workspace packages, and returns rule errors", async () => {
		await Promise.all([
			monorepo.addPackage({ name: "valid-package" }),
			monorepo.addPackage({ name: "invalid-package", manifest: { private: false } }),
			writeConfig(`
				export default {
					type: "monoswan-config",
					rules: [{
						name: "require-private",
						async check(context) {
							if (context.packageJson.private !== false) return [];

							return [{
								message: "package must be private",
								packageContext: {
									packageName: context.packageName,
									packagePath: context.packagePath,
								},
								filePath: context.packagePath + "/package.json",
								locator: { type: "json", locator: ["private"] },
							}];
						},
					}],
				};
			`),
		]);

		const result = await lint(monorepo.rootPath);

		expect(result.isOk).toBe(true);
		if (result.isErr) return;

		const invalidPackage = monorepo.packages.get("packages/invalid-package");
		expect(invalidPackage).toBeDefined();
		expect(result.value).toEqual([
			{
				message: "package must be private",
				packageContext: {
					packageName: "invalid-package",
					packagePath: invalidPackage?.rootPath,
				},
				filePath: invalidPackage?.resolvePath("package.json"),
				locator: { type: "json", locator: ["private"] },
			},
		]);
	});

	it("discovers from the workspace root when linting within a package", async () => {
		const [selectedPackage] = await Promise.all([
			monorepo.addPackage({ name: "selected-package" }),
			monorepo.addPackage({ name: "sibling-package" }),
			writeConfig(`
				export default {
					type: "monoswan-config",
					rules: [{
						name: "report-package",
						check(context) {
							return [{
								message: context.packageName,
								packageContext: context,
								filePath: context.packagePath + "/package.json",
							}];
						},
					}],
				};
			`),
		]);

		const result = await lint(selectedPackage.resolvePath("src"));

		expect(result.isOk).toBe(true);
		if (result.isOk) {
			expect(result.value.map(({ packageContext }) => packageContext.packageName)).toEqual([
				"selected-package",
			]);
		}
	});

	it("resolves package variants before running rules", async () => {
		await Promise.all([
			monorepo.addPackage({
				name: "library",
				manifest: { monoswan: { variants: ["library"] } },
			}),
			writeConfig(`
				export default {
					type: "monoswan-config",
					variants: {
						library: { packageJson: { scripts: { build: "tsc" } } },
					},
					rules: [{
						name: "observe-resolved-variant",
						check(context) {
							if (context.packageName !== "library") return [];
							if (context.variant.packageJson?.scripts?.build === "tsc") return [];

							return [{
								message: "library variant was not resolved",
								packageContext: context,
								filePath: context.packagePath + "/package.json",
							}];
						},
					}],
				};
			`),
		]);

		const result = await lint(monorepo.rootPath);

		expect(result.isOk).toBe(true);
		if (result.isOk) expect(result.value).toEqual([]);
	});

	it("applies each rule only to packages not matched by its ignore config", async () => {
		await Promise.all([
			monorepo.addPackage({ name: "ignored-package", manifest: { private: false } }),
			monorepo.addPackage({ name: "included-package", manifest: { private: false } }),
			writeConfig(`
				export default {
					type: "monoswan-config",
					rules: [
						{
							name: "ignored-by-name",
							ignore: { packages: ["ignored-*"] },
							check(context) {
								if (context.packageJson.private !== false) return [];
								return [{
									message: "name rule",
									packageContext: context,
									filePath: context.packagePath + "/package.json",
								}];
							},
						},
						{
							name: "ignored-by-path",
							ignore: { paths: ["packages/ignored-*"] },
							check(context) {
								if (context.packageJson.private !== false) return [];
								return [{
									message: "path rule",
									packageContext: context,
									filePath: context.packagePath + "/package.json",
								}];
							},
						},
					],
				};
			`),
		]);

		const result = await lint(monorepo.rootPath);

		expect(result.isOk).toBe(true);
		if (result.isOk) {
			expect(
				result.value.map(({ message, packageContext }) => [message, packageContext.packageName]),
			).toEqual([
				["name rule", "included-package"],
				["path rule", "included-package"],
			]);
		}
	});

	it("rejects when no configuration can be found", async () => {
		const result = await lint(monorepo.rootPath);

		expect(result.isErr).toBe(true);
		if (result.isErr) expect(result.error).toEqual({ type: "CONFIG_NOT_FOUND" });
	});

	it("rejects packages that reference an unknown variant", async () => {
		const testPackage = await monorepo.addPackage({
			name: "invalid-variant-package",
			manifest: { monoswan: { variants: ["missing"] } },
		});
		await writeConfig(`export default { type: "monoswan-config" };`);

		const result = await lint(monorepo.rootPath);

		expect(result.isErr).toBe(true);
		if (result.isErr) {
			expect(result.error).toEqual({
				type: "INVALID_VARIANTS",
				packagePath: testPackage.rootPath,
				variantNames: ["missing"],
			});
		}
	});

	it("maps thrown rule errors to FAILED_TO_RUN_CHECK", async () => {
		await Promise.all([
			monorepo.addPackage({ name: "example" }),
			writeConfig(`
				export default {
					type: "monoswan-config",
					rules: [{
						name: "throws",
						check() {
							throw new Error("rule failed");
						},
					}],
				};
			`),
		]);

		const result = await lint(monorepo.rootPath);

		expect(result.isErr).toBe(true);
		if (result.isErr) {
			expect(result.error).toMatchObject({ type: "FAILED_TO_RUN_CHECK" });
			expect(result.error).toHaveProperty("error", expect.any(Error));
		}
	});

	it("maps thrown merge errors to FAILED_TO_MERGE_VARIANT", async () => {
		await Promise.all([
			monorepo.addPackage({
				name: "library",
				manifest: { monoswan: { variants: ["library"] } },
			}),
			writeConfig(`
				export default {
					type: "monoswan-config",
					variants: { library: { packageJson: { private: true } } },
					merge: {
						mergePackageManifests() {
							throw new Error("merge failed");
						},
					},
				};
			`),
		]);

		const result = await lint(monorepo.rootPath);

		expect(result.isErr).toBe(true);
		if (result.isOk) return;
		expect(result.error).toMatchObject({
			type: "FAILED_TO_MERGE_VARIANT",
			error: expect.objectContaining({ message: "merge failed" }),
		});
	});

	it("maps thrown variant errors to VARIANT_CREATION_FAILED", async () => {
		await Promise.all([
			monorepo.addPackage({
				name: "library",
				manifest: { monoswan: { variants: ["library"] } },
			}),
			writeConfig(`
				export default {
					type: "monoswan-config",
					variants: {
						library() {
							throw new Error("variant failed");
						},
					},
				};
			`),
		]);

		const result = await lint(monorepo.rootPath);

		expect(result.isErr).toBe(true);
		if (result.isOk) return;
		expect(result.error).toMatchObject({
			type: "VARIANT_CREATION_FAILED",
			packagePath: expect.any(String),
			variantNames: ["library"],
			error: expect.objectContaining({ message: "variant failed" }),
		});
	});
});

const workspaceMatrix: Array<{ name: string; workspace: TestWorkspaceOptions }> = [
	{ name: "pnpm", workspace: { packageManager: "pnpm" } },
	{ name: "npm", workspace: { packageManager: "npm" } },
	{ name: "Yarn", workspace: { packageManager: "yarn" } },
	{
		name: "Yarn object form",
		workspace: { packageManager: "yarn", workspaceFormat: "object" },
	},
	{ name: "Bun", workspace: { packageManager: "bun" } },
];

describe.each(workspaceMatrix)("lint in a $name workspace", ({ workspace }) => {
	it("only checks manifests selected by workspace patterns", async () => {
		const workspaceProject = await createTestMonorepo({
			workspace: {
				...workspace,
				patterns: ["packages/*", "packages/test/*", "tests/*", "!packages/excluded"],
			} as TestWorkspaceOptions,
			packages: [
				{ name: "included", directory: "packages/included", manifest: { private: false } },
				{ name: "excluded", directory: "packages/excluded", manifest: { private: false } },
				{
					name: "integration-app",
					directory: "tests/integration-app",
					manifest: { private: false },
				},
				{
					name: "test-helper",
					directory: "packages/test/helper",
					manifest: { private: false },
				},
				{
					name: "nested",
					directory: "packages/included/nested",
					manifest: { private: false },
				},
				{
					name: "out-of-pattern",
					directory: "examples/demo",
					manifest: { private: false },
				},
			],
		});

		try {
			await Promise.all([
				workspaceProject.writeFile("fixtures/broken/package.json", "{not valid json"),
				workspaceProject.writeFile(
					"monoswan.config.ts",
					`export default {
						type: "monoswan-config",
						rules: [{
							name: "require-private",
							check(context) {
								return context.packageJson.private === false ? [{
									message: "package must be private",
									packageContext: context,
									filePath: context.packagePath + "/package.json",
								}] : [];
							},
						}],
					};`,
				),
			]);

			const result = await lint(workspaceProject.rootPath);

			expect(result.isOk).toBe(true);
			if (result.isOk) {
				expect(
					result.value.map(({ packageContext }) => packageContext.packageName).toSorted(),
				).toEqual(["included", "integration-app", "test-helper"]);
			}
		} finally {
			await workspaceProject.cleanup();
		}
	});
});
