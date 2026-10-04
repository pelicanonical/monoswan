import { createTestPackage, type TestPackage } from "@monoswan/testing-utils";
import type { Project } from "@pnpm/workspace.projects-reader";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadPackageConfig, getPackageContext, getPackageVariantNames } from "../package.ts";

let testPackage: TestPackage;

beforeEach(async () => {
  testPackage = await createTestPackage({ name: "example" });
});

afterEach(async () => {
  await testPackage.cleanup();
});

type TestProject = Project & Parameters<typeof loadPackageConfig>[0];
type TestManifest = Project["manifest"] & { monoswan?: unknown };

const getProject = (manifest: TestManifest): TestProject =>
  ({
    manifest,
    packageJson: manifest,
    packagePath: testPackage.rootPath,
    rootDir: testPackage.rootPath,
    rootDirRealPath: testPackage.rootPath,
    writeProjectManifest: vi.fn(),
  }) as unknown as TestProject;

describe("getPackageVariants", () => {
  it("normalizes absent and array variants", () => {
    expect(getPackageVariantNames(undefined)).toEqual([]);
    expect(getPackageVariantNames({})).toEqual([]);
    expect(getPackageVariantNames({ variants: ["app", "strict"] })).toEqual(["app", "strict"]);
  });
});

describe("getPackageConfig", () => {
  it("reads embedded manifest configuration", async () => {
    const result = await loadPackageConfig(
      getProject({ name: "example", monoswan: { variants: ["library"] } }),
    );

    expect(result.isOk).toBe(true);
    if (result.isOk) expect(result.value).toEqual({ variants: ["library"] });
  });

  it("returns undefined when the manifest has no configuration", async () => {
    const result = await loadPackageConfig(getProject({ name: "example" }));

    expect(result.isOk).toBe(true);
    if (result.isOk) expect(result.value).toBeUndefined();
  });

  it("prefers a standalone monoswan.json", async () => {
    await testPackage.writeJson("monoswan.json", { variants: ["standalone"] });

    const result = await loadPackageConfig(
      getProject({ name: "example", monoswan: { variants: "embedded" } }),
    );

    expect(result.isOk).toBe(true);
    if (result.isOk) expect(result.value).toEqual({ variants: ["standalone"] });
  });

  it("reads JSONC standalone configuration", async () => {
    await testPackage.writeFile(
      "monoswan.json",
      `{
				// Select package variants
				"variants": ["standalone"],
			}`,
    );

    const result = await loadPackageConfig(getProject({ name: "example" }));

    expect(result.isOk).toBe(true);
    if (result.isOk) expect(result.value).toEqual({ variants: ["standalone"] });
  });

  it("rejects invalid standalone JSON", async () => {
    await testPackage.writeFile("monoswan.json", "not json");

    const result = await loadPackageConfig(getProject({ name: "example" }));

    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toMatchObject({ type: "INVALID_JSON" });
  });

  it("rejects configuration that does not match the schema", async () => {
    const result = await loadPackageConfig(
      getProject({ name: "example", monoswan: { variants: 42 } }),
    );

    expect(result.isErr).toBe(true);
    if (result.isErr) {
      expect(result.error).toMatchObject({ type: "INVALID_PACKAGE_CONFIG" });
      expect(result.error).toHaveProperty("issues");
    }
  });

  it("validates standalone configuration with the same schema as embedded configuration", async () => {
    await testPackage.writeJson("monoswan.json", { variants: 42 });

    const result = await loadPackageConfig(getProject({ name: "example" }));

    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toMatchObject({ type: "INVALID_PACKAGE_CONFIG" });
  });
});

it("creates package context from a project", () => {
  expect(getPackageContext(getProject({ name: "example" }))).toEqual({
    packageName: "example",
    packagePath: testPackage.rootPath,
    packageJson: { name: "example" },
  });
});
