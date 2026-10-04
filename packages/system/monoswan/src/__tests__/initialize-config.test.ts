import { createTestMonorepo, type TestMonorepo } from "@monoswan/testing-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initializeConfig } from "../initialize-config.ts";

let monorepo: TestMonorepo;

beforeEach(async () => {
	monorepo = await createTestMonorepo({ name: "initialize-config-fixture" });
});

afterEach(async () => {
	await monorepo.cleanup();
});

describe("initializeConfig", () => {
	it("creates a default monoswan configuration", async () => {
		const result = await initializeConfig(monorepo.rootPath);

		expect(result.isErr ? result.error : undefined).toBeUndefined();
		expect(await monorepo.readFile("monoswan.config.ts")).toBe(
			`import { defineConfig, enforceVariants, sortPackageJson } from "monoswan";

export default defineConfig({
	variants: {
		lib: {},
	},
	rules: [enforceVariants(), sortPackageJson()],
});
`,
		);
	});

	it("creates a missing target directory", async () => {
		const directoryPath = monorepo.resolvePath("nested", "repo");

		const result = await initializeConfig(directoryPath);

		expect(result.isErr ? result.error : undefined).toBeUndefined();
		expect(await monorepo.readFile("nested/repo/monoswan.config.ts")).toContain("lib: {}");
	});

	it("does not overwrite an existing configuration", async () => {
		await monorepo.writeFile("monoswan.config.ts", "existing\n");

		const result = await initializeConfig(monorepo.rootPath);

		expect(result.isErr).toBe(true);
		if (result.isErr) {
			expect(result.error).toEqual({
				type: "CONFIG_ALREADY_EXISTS",
				path: monorepo.resolvePath("monoswan.config.ts"),
			});
		}
		expect(await monorepo.readFile("monoswan.config.ts")).toBe("existing\n");
	});

	it("does not create a TypeScript config when an MTS config exists", async () => {
		await monorepo.writeFile("monoswan.config.mts", "existing\n");

		const result = await initializeConfig(monorepo.rootPath);

		expect(result.isErr).toBe(true);
		if (result.isErr) {
			expect(result.error).toEqual({
				type: "CONFIG_ALREADY_EXISTS",
				path: monorepo.resolvePath("monoswan.config.mts"),
			});
		}
		await expect(monorepo.readFile("monoswan.config.mts")).resolves.toBe("existing\n");
	});
});
