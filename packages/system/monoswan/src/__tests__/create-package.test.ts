import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createTestMonorepo, type TestMonorepo } from "@monoswan/testing-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPackageFromVariants } from "../create-package.ts";

let monorepo: TestMonorepo;

beforeEach(async () => {
  monorepo = await createTestMonorepo({ name: "create-package-fixture" });
});

afterEach(async () => {
  await monorepo.cleanup();
});

const writeConfig = (variants: string) =>
  monorepo.writeFile(
    "monoswan.config.ts",
    `export default { type: "monoswan-config", variants: ${variants} };`,
  );

describe("createPackageFromVariants", () => {
  it("merges each variant config and initializer in CLI order and writes every file type", async () => {
    await writeConfig(`{
			first: {
				packageJson: { private: true, scripts: { first: "config", shared: "first-config" } },
				tsConfig: { compilerOptions: { strict: true, target: "ES2022" } },
				tsConfigs: { "configs/tsconfig.build.json": { compilerOptions: { declaration: false } } },
				additionalJsonFiles: { "config/settings.json": { config: { first: true } } },
				additionalTextFiles: { "README.md": "first config", "NOTICE": "first" },
				initialization: {
					packageJson: { scripts: { shared: "first-initializer", firstInit: "yes" } },
					tsConfig: { compilerOptions: { target: "ESNext" } },
					tsConfigs: { "configs/tsconfig.build.json": { compilerOptions: { declaration: true } } },
					additionalJsonFiles: { "config/settings.json": { initializer: { first: true } } },
					additionalTextFiles: { "README.md": "first initializer" },
				},
			},
			second: {
				packageJson: { name: "wrong-name", scripts: { shared: "second-config", second: "config" } },
				additionalJsonFiles: { "config/settings.json": { config: { second: true } } },
				initialization: {
					packageJson: { scripts: { shared: "second-initializer", secondInit: "yes" } },
					additionalJsonFiles: { "config/settings.json": { initializer: { second: true } } },
					additionalTextFiles: { "README.md": "second initializer", "src/index.ts": "export {};\\n" },
				},
			},
		}`);
    const packagePath = monorepo.resolvePath("packages", "created");

    const result = await createPackageFromVariants(packagePath, "@example/created", [
      "first",
      "second",
    ]);

    expect(result.isErr ? result.error : undefined).toBeUndefined();
    expect(await monorepo.readJson("packages/created/package.json")).toEqual({
      private: true,
      scripts: {
        first: "config",
        shared: "second-initializer",
        firstInit: "yes",
        second: "config",
        secondInit: "yes",
      },
      name: "@example/created",
      monoswan: { variants: ["first", "second"] },
    });
    expect(await monorepo.readJson("packages/created/tsconfig.json")).toEqual({
      compilerOptions: { strict: true, target: "ESNext" },
    });
    expect(await monorepo.readJson("packages/created/config/settings.json")).toEqual({
      config: { first: true, second: true },
      initializer: { first: true, second: true },
    });
    expect(await monorepo.readJson("packages/created/configs/tsconfig.build.json")).toEqual({
      compilerOptions: { declaration: true },
    });
    expect(await monorepo.readFile("packages/created/README.md")).toBe("second initializer");
    expect(await monorepo.readFile("packages/created/src/index.ts")).toBe("export {};\n");
    expect(existsSync(monorepo.resolvePath("packages/created/monoswan.json"))).toBe(false);
  });

  it("resolves context-based variants for the package being created", async () => {
    await writeConfig(`{
			contextual: (context) => ({
				initialization: {
					packageJson: { description: context.packageName },
					additionalTextFiles: { "context.txt": context.packagePath },
				},
			}),
		}`);
    const packagePath = monorepo.resolvePath("packages", "contextual");

    const result = await createPackageFromVariants(packagePath, "@example/contextual", [
      "contextual",
    ]);

    expect(result.isErr ? result.error : undefined).toBeUndefined();
    expect(await monorepo.readJson("packages/contextual/package.json")).toMatchObject({
      name: "@example/contextual",
      description: "@example/contextual",
    });
    expect(await monorepo.readFile("packages/contextual/context.txt")).toBe(packagePath);
  });

  it("can write the monoswan config to a standalone file", async () => {
    await writeConfig(`{
			library: { packageJson: { private: true, monoswan: { variants: ["wrong"] } } },
		}`);
    const packagePath = monorepo.resolvePath("packages", "created");

    const result = await createPackageFromVariants(
      packagePath,
      "@example/created",
      ["library"],
      "standalone",
    );

    expect(result.isErr ? result.error : undefined).toBeUndefined();
    expect(await monorepo.readJson("packages/created/package.json")).toEqual({
      private: true,
      name: "@example/created",
    });
    expect(await monorepo.readJson("packages/created/monoswan.json")).toEqual({
      variants: ["library"],
    });
  });

  it("protects generated files from initializer file entries", async () => {
    await writeConfig(`{
			library: {
				initialization: {
					tsConfig: { compilerOptions: { strict: true } },
					additionalTextFiles: {
						"package.json": "wrong package",
						"monoswan.json": "wrong config",
						"tsconfig.json": "wrong tsconfig",
					},
				},
			},
		}`);
    const packagePath = monorepo.resolvePath("packages", "created");

    const result = await createPackageFromVariants(
      packagePath,
      "@example/created",
      ["library"],
      "standalone",
    );

    expect(result.isErr ? result.error : undefined).toBeUndefined();
    expect(await monorepo.readJson("packages/created/package.json")).toEqual({
      name: "@example/created",
    });
    expect(await monorepo.readJson("packages/created/monoswan.json")).toEqual({
      variants: ["library"],
    });
    expect(await monorepo.readJson("packages/created/tsconfig.json")).toEqual({
      compilerOptions: { strict: true },
    });
  });

  it("creates a minimal package when no variants are selected", async () => {
    await writeConfig(`{}`);
    const packagePath = monorepo.resolvePath("packages", "empty");

    const result = await createPackageFromVariants(packagePath, "empty", []);

    expect(result.isErr ? result.error : undefined).toBeUndefined();
    expect(await monorepo.readJson("packages/empty/package.json")).toEqual({
      name: "empty",
      monoswan: { variants: [] },
    });
  });

  it("rejects unknown variants without creating the destination", async () => {
    await writeConfig(`{ known: {} }`);
    const packagePath = monorepo.resolvePath("packages", "created");

    const result = await createPackageFromVariants(packagePath, "created", [
      "missing",
      "known",
      "also-missing",
    ]);

    expect(result.isErr).toBe(true);
    if (result.isErr) {
      expect(result.error).toEqual({
        type: "INVALID_VARIANTS",
        packagePath,
        variantNames: ["missing", "also-missing"],
      });
    }
    expect(existsSync(packagePath)).toBe(false);
  });

  it("rejects creation when no repository configuration can be found", async () => {
    const packagePath = monorepo.resolvePath("packages", "created");

    const result = await createPackageFromVariants(packagePath, "created", ["library"]);

    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toEqual({ type: "CONFIG_NOT_FOUND" });
    expect(existsSync(packagePath)).toBe(false);
  });

  it("rejects an invalid repository configuration without creating the destination", async () => {
    await monorepo.writeFile("monoswan.config.ts", `export default { type: "wrong" };`);
    const packagePath = monorepo.resolvePath("packages", "created");

    const result = await createPackageFromVariants(packagePath, "created", ["library"]);

    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error.type).toBe("INVALID_DEFAULT_EXPORT");
    expect(existsSync(packagePath)).toBe(false);
  });

  it("does not overwrite an existing destination", async () => {
    await writeConfig(`{ known: {} }`);
    const existingPackage = await monorepo.addPackage({ name: "existing" });

    const result = await createPackageFromVariants(existingPackage.rootPath, "existing", ["known"]);

    expect(result.isErr).toBe(true);
    if (result.isErr) {
      expect(result.error).toEqual({
        type: "PACKAGE_ALREADY_EXISTS",
        path: existingPackage.rootPath,
      });
    }
  });

  it("does not overwrite an existing empty directory", async () => {
    await writeConfig(`{ known: {} }`);
    const packagePath = monorepo.resolvePath("packages", "empty");
    await mkdir(packagePath, { recursive: true });

    const result = await createPackageFromVariants(packagePath, "empty", ["known"]);

    expect(result.isErr).toBe(true);
    if (result.isErr) {
      expect(result.error).toEqual({ type: "PACKAGE_ALREADY_EXISTS", path: packagePath });
    }
  });

  it("rejects initializer paths outside the package", async () => {
    await writeConfig(`{
			unsafe: { initialization: { additionalTextFiles: { "../outside.txt": "nope" } } },
		}`);
    const packagePath = monorepo.resolvePath("packages", "created");

    const result = await createPackageFromVariants(packagePath, "created", ["unsafe"]);

    expect(result.isErr).toBe(true);
    if (result.isErr) {
      expect(result.error).toEqual({
        type: "INVALID_INITIALIZER_PATH",
        path: "../outside.txt",
      });
    }
    expect(existsSync(packagePath)).toBe(false);
  });

  it.each([
    ["text", `additionalTextFiles: { "nested/../../../outside.txt": "nope" }`],
    ["JSON", `additionalJsonFiles: { "nested/../../../outside.json": {} }`],
    ["tsconfig", `tsConfigs: { "nested/../../../outside.json": {} }`],
  ])("rejects traversal paths in additional %s files before writing", async (_, content) => {
    await writeConfig(`{ unsafe: { initialization: { ${content} } } }`);
    const packagePath = monorepo.resolvePath("packages", "created");

    const result = await createPackageFromVariants(packagePath, "created", ["unsafe"]);

    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error.type).toBe("INVALID_INITIALIZER_PATH");
    expect(existsSync(packagePath)).toBe(false);
  });

  it("rejects absolute initializer paths before writing", async () => {
    const outsidePath = monorepo.resolvePath("outside.txt");
    await writeConfig(`{
			unsafe: { initialization: { additionalTextFiles: { ${JSON.stringify(outsidePath)}: "nope" } } },
		}`);
    const packagePath = monorepo.resolvePath("packages", "created");

    const result = await createPackageFromVariants(packagePath, "created", ["unsafe"]);

    expect(result.isErr).toBe(true);
    if (result.isErr) {
      expect(result.error).toEqual({ type: "INVALID_INITIALIZER_PATH", path: outsidePath });
    }
    expect(existsSync(packagePath)).toBe(false);
  });

  it("returns a creation failure when a file collides with a generated directory", async () => {
    await writeConfig(`{
			broken: {
				initialization: {
					additionalTextFiles: { "blocked/child.txt": "child", "blocked": "file" },
				},
			},
		}`);
    const packagePath = monorepo.resolvePath("packages", "created");

    const result = await createPackageFromVariants(packagePath, "created", ["broken"]);

    expect(result.isErr).toBe(true);
    if (result.isErr) {
      expect(result.error).toMatchObject({
        type: "CREATE_PACKAGE_FAILED",
        error: { type: "FAILED_TO_WRITE_FILE" },
      });
    }
  });
});
