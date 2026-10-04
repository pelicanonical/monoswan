import picomatch from "picomatch";
import { mkdir, unlink } from "node:fs/promises";
import {
  createTestMonorepo,
  createTestPackage,
  type TestPackage,
  type TestWorkspaceOptions,
} from "@monoswan/testing-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PackageManifestContext } from "../../types/context.ts";
import { getRepoPackages, getWorkspacePaths, isPackageIgnored } from "../repo.ts";

let project: TestPackage;

beforeEach(async () => {
  project = await createTestPackage();
});

afterEach(async () => {
  await project.cleanup();
});

const pkg: PackageManifestContext = {
  packageName: "@monoswan/site",
  packagePath: "/repo/apps/site",
  packageJson: { name: "@monoswan/site" },
};

describe("isPackageIgnored", () => {
  it("matches path globs against the package path relative to the repository", () => {
    expect(isPackageIgnored(pkg, "/repo", picomatch("./apps/**/*"), picomatch([]))).toBe(true);
  });

  it("matches package-name globs independently of the path", () => {
    expect(isPackageIgnored(pkg, "/repo", picomatch([]), picomatch("@monoswan/*"))).toBe(true);
  });

  it("does not ignore a package when neither matcher matches", () => {
    expect(isPackageIgnored(pkg, "/repo", picomatch("packages/*"), picomatch("other-*"))).toBe(
      false,
    );
  });
});

describe("getWorkspacePaths", () => {
  it("reads pnpm workspace patterns", async () => {
    await project.writeFile(
      "pnpm-workspace.yaml",
      'packages:\n  - "packages/*"\n  - "!packages/legacy"\n',
    );

    const result = await getWorkspacePaths(project.rootPath);

    expect(result.isOk).toBe(true);
    if (result.isOk) expect(result.value).toEqual(["packages/*", "!packages/legacy"]);
  });

  it("reads package.json workspace arrays", async () => {
    await project.writePackageJson({ workspaces: ["packages/*", "apps/*"] });

    const result = await getWorkspacePaths(project.rootPath);

    expect(result.isOk).toBe(true);
    if (result.isOk) expect(result.value).toEqual(["packages/*", "apps/*"]);
  });

  it("reads Yarn object-form workspaces", async () => {
    await project.writePackageJson({ workspaces: { packages: ["packages/*"] } });

    const result = await getWorkspacePaths(project.rootPath);

    expect(result.isOk).toBe(true);
    if (result.isOk) expect(result.value).toEqual(["packages/*"]);
  });

  it("prefers pnpm-workspace.yaml over package.json workspaces", async () => {
    await project.writePackageJson({ workspaces: ["apps/*"] });
    await project.writeFile("pnpm-workspace.yaml", 'packages:\n  - "packages/*"\n');

    const result = await getWorkspacePaths(project.rootPath);

    expect(result.isOk).toBe(true);
    if (result.isOk) expect(result.value).toEqual(["packages/*"]);
  });

  it("rejects an invalid workspace declaration", async () => {
    await project.writePackageJson({ workspaces: "packages/*" });

    const result = await getWorkspacePaths(project.rootPath);

    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toMatchObject({ type: "INVALID_WORKSPACE" });
  });

  it("rejects malformed package.json", async () => {
    await project.writeFile("package.json", "{not valid json");

    const result = await getWorkspacePaths(project.rootPath);

    expect(result.isErr).toBe(true);
    if (result.isErr) {
      expect(result.error).toEqual({
        type: "INVALID_WORKSPACE",
        path: project.packageJsonPath,
      });
    }
  });

  it("rejects malformed pnpm workspace YAML", async () => {
    await project.writeFile("pnpm-workspace.yaml", "packages: [");

    const result = await getWorkspacePaths(project.rootPath);

    expect(result.isErr).toBe(true);
    if (result.isErr) {
      expect(result.error).toEqual({
        type: "INVALID_WORKSPACE",
        path: project.resolvePath("pnpm-workspace.yaml"),
      });
    }
  });

  it("rejects a pnpm workspace without a packages array", async () => {
    await project.writeFile("pnpm-workspace.yaml", "catalog: {}\n");

    const result = await getWorkspacePaths(project.rootPath);

    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toMatchObject({ type: "INVALID_WORKSPACE" });
  });

  it("reports when no workspace declaration exists", async () => {
    await unlink(project.packageJsonPath);

    const result = await getWorkspacePaths(project.rootPath);

    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toEqual({ type: "WORKSPACE_NOT_FOUND" });
  });

  it("maps workspace file read failures", async () => {
    const workspacePath = project.resolvePath("pnpm-workspace.yaml");
    await mkdir(workspacePath);

    const result = await getWorkspacePaths(project.rootPath);

    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toMatchObject({ type: "FAILED_TO_READ_WORKSPACE" });
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

describe.each(workspaceMatrix)("$name workspace discovery", ({ workspace }) => {
  it("honors inclusions, exclusions, nesting, and test paths without including the root", async () => {
    const monorepo = await createTestMonorepo({
      name: "workspace-root",
      workspace: {
        ...workspace,
        patterns: ["packages/*", "packages/test/*", "tests/*", "!packages/excluded"],
      } as TestWorkspaceOptions,
      packages: [
        { name: "included", directory: "packages/included" },
        { name: "excluded", directory: "packages/excluded" },
        { name: "integration-app", directory: "tests/integration-app" },
        { name: "test-helper", directory: "packages/test/helper" },
        { name: "nested", directory: "packages/included/nested" },
        { name: "out-of-pattern", directory: "examples/demo" },
      ],
    });

    try {
      await monorepo.writeFile("fixtures/broken/package.json", "{not valid json");

      const result = await getRepoPackages(monorepo.rootPath);

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.map(({ packageName }) => packageName).toSorted()).toEqual([
          "included",
          "integration-app",
          "test-helper",
        ]);
      }
    } finally {
      await monorepo.cleanup();
    }
  });
});

describe("workspace discovery failures", () => {
  it("rejects a malformed manifest selected by a workspace pattern", async () => {
    const monorepo = await createTestMonorepo({
      workspace: { packageManager: "pnpm", patterns: ["packages/*"] },
    });

    try {
      await monorepo.writeFile("packages/broken/package.json", "{not valid json");
      const result = await getRepoPackages(monorepo.rootPath);

      expect(result.isErr).toBe(true);
      if (result.isErr) expect(result.error).toMatchObject({ type: "FIND_PACKAGES_FAILED" });
    } finally {
      await monorepo.cleanup();
    }
  });
});
