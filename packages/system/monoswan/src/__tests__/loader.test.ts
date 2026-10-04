import { createTestPackage, type TestPackage } from "@monoswan/testing-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getMonoswanConfig, loadMonoswanConfig } from "../loader.ts";

let project: TestPackage;

beforeEach(async () => {
	project = await createTestPackage();
});

afterEach(async () => {
	await project.cleanup();
});

describe("loadMonoswanConfig", () => {
	it("loads a valid TypeScript configuration", async () => {
		await project.writeFile(
			"monoswan.config.ts",
			'export default { type: "monoswan-config", variants: { app: {} } };',
		);

		const result = await loadMonoswanConfig(project.resolvePath("monoswan.config.ts"));

		expect(result.isOk).toBe(true);
		if (result.isOk) expect(result.value.variants).toEqual({ app: {} });
	});

	it.each([
		["null", "CONFIG_LOAD_FAILED"],
		["{}", "INVALID_DEFAULT_EXPORT"],
		['{ type: "wrong" }', "INVALID_DEFAULT_EXPORT"],
	] as const)("rejects the default export %s", async (defaultExport, errorType) => {
		await project.writeFile("monoswan.config.ts", `export default ${defaultExport};`);

		const result = await loadMonoswanConfig(project.resolvePath("monoswan.config.ts"));

		expect(result.isErr).toBe(true);
		if (result.isErr) expect(result.error).toMatchObject({ type: errorType });
	});

	it("maps module-loading failures", async () => {
		await project.writeFile(
			"monoswan.config.ts",
			'import "missing-test-module"; export default {};',
		);

		const result = await loadMonoswanConfig(project.resolvePath("monoswan.config.ts"));

		expect(result.isErr).toBe(true);
		if (result.isErr) expect(result.error).toMatchObject({ type: "CONFIG_LOAD_FAILED" });
	});

	it("finds and loads a configuration from a nested path", async () => {
		await project.writeFile("monoswan.config.ts", 'export default { type: "monoswan-config" };');

		const result = await getMonoswanConfig(project.resolvePath("packages", "app"));

		expect(result.isOk).toBe(true);
	});
});
