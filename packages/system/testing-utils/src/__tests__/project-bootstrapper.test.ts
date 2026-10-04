import { stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createTestMonorepo, createTestPackage } from "../project-bootstrapper.ts";

describe("createTestPackage", () => {
  it("creates a package manifest and nested fixture files", async () => {
    const testPackage = await createTestPackage({
      name: "example",
      manifest: { description: "fixture", private: false, version: "1.2.3" },
      files: { "src/index.ts": "export {};\n" },
      jsonFiles: { "config/settings.json": { enabled: true } },
    });

    try {
      expect(await testPackage.readPackageJson()).toEqual({
        name: "example",
        version: "1.2.3",
        private: false,
        description: "fixture",
      });
      expect(await testPackage.readFile("src/index.ts")).toBe("export {};\n");
      expect(await testPackage.readJson("config/settings.json")).toEqual({ enabled: true });
      expect(testPackage.packageJsonPath).toBe(testPackage.resolvePath("package.json"));
    } finally {
      await testPackage.cleanup();
    }
  });

  it("rejects paths outside the package and cleans up idempotently", async () => {
    const testPackage = await createTestPackage();
    const rootPath = testPackage.rootPath;

    expect(() => testPackage.resolvePath("..", "outside.txt")).toThrow(
      "Project path must remain within",
    );
    await testPackage.cleanup();
    await testPackage.cleanup();
    await expect(stat(rootPath)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("createTestMonorepo", () => {
  it("creates a pnpm workspace with initial and dynamically added packages", async () => {
    const monorepo = await createTestMonorepo({
      name: "fixture-repo",
      workspace: { packageManager: "pnpm", patterns: ["packages/*", "apps/*"] },
      packages: [
        { name: "alpha", files: { "src/index.ts": "export const alpha = true;\n" } },
        { directory: "apps/site", manifest: { description: "site fixture" } },
      ],
    });

    try {
      expect(await monorepo.readJson("package.json")).toMatchObject({
        name: "fixture-repo",
        private: true,
      });
      expect(await monorepo.readFile("pnpm-workspace.yaml")).toBe(
        'packages:\n  - "packages/*"\n  - "apps/*"\n',
      );
      expect(monorepo.packages.get("packages/alpha")?.rootPath).toBe(
        monorepo.resolvePath("packages/alpha"),
      );
      const site = monorepo.packages.get("apps/site");
      expect(site).toBeDefined();
      expect(await site?.readPackageJson()).toMatchObject({
        name: "site",
        description: "site fixture",
      });

      const beta = await monorepo.addPackage({ name: "beta" });
      expect(beta.rootPath).toBe(monorepo.resolvePath("packages/beta"));
      expect(await beta.readPackageJson()).toMatchObject({ name: "beta" });
      expect(monorepo.packages.get("packages/beta")).toBe(beta);
    } finally {
      await monorepo.cleanup();
    }
  });

  it.each([
    { packageManager: "npm" as const, expectedWorkspaces: ["packages/*", "apps/*"] },
    { packageManager: "yarn" as const, expectedWorkspaces: ["packages/*", "apps/*"] },
    { packageManager: "bun" as const, expectedWorkspaces: ["packages/*", "apps/*"] },
  ])("creates a $packageManager package.json workspace", async (fixture) => {
    const monorepo = await createTestMonorepo({
      workspace: {
        packageManager: fixture.packageManager,
        patterns: ["packages/*", "apps/*"],
      },
    });

    try {
      expect(await monorepo.readJson("package.json")).toMatchObject({
        workspaces: fixture.expectedWorkspaces,
      });
      expect(await monorepo.fileExists("pnpm-workspace.yaml")).toBe(false);
      expect(monorepo.workspace).toEqual({
        packageManager: fixture.packageManager,
        patterns: ["packages/*", "apps/*"],
        declarationPath: "package.json",
      });
    } finally {
      await monorepo.cleanup();
    }
  });

  it("creates a Yarn object-form workspace", async () => {
    const monorepo = await createTestMonorepo({
      workspace: {
        packageManager: "yarn",
        workspaceFormat: "object",
        patterns: ["packages/*"],
      },
    });

    try {
      expect(await monorepo.readJson("package.json")).toMatchObject({
        workspaces: { packages: ["packages/*"] },
      });
      expect(monorepo.workspace.packageManager).toBe("yarn");
    } finally {
      await monorepo.cleanup();
    }
  });
});
