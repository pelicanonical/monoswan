import { type Project, findPackages } from "@pnpm/workspace.projects-reader";
import path from "node:path";
import { load as parseYaml } from "js-yaml";
import type picomatch from "picomatch";
import { Result } from "true-myth";
import { tryOrElse } from "true-myth/result";
import { fromPromise, fromResult } from "true-myth/task";
import * as v from "valibot";
import { getPackageContext } from "./package.ts";
import type { PackageManifestContext } from "../types/context.ts";
import { doesFileExist, readFileContents } from "./file.ts";
import { parseJson } from "./parse.ts";

export type GetRepoPackagesError =
  | GetWorkspacePathsError
  | { type: "FIND_PACKAGES_FAILED"; error: unknown };

export type GetRepoPackages = GetRepoPackagesError;

export type GetWorkspacePathsError =
  | { type: "WORKSPACE_NOT_FOUND" }
  | { type: "FAILED_TO_READ_WORKSPACE"; error: unknown }
  | { type: "INVALID_WORKSPACE"; path: string };

const WorkspacePathsSchema = v.array(v.string());
const PnpmWorkspaceSchema = v.object({ packages: WorkspacePathsSchema });
const PackageJsonWorkspaceSchema = v.object({
  workspaces: v.union([WorkspacePathsSchema, v.object({ packages: WorkspacePathsSchema })]),
});

const invalidWorkspace = (workspacePath: string) => ({
  type: "INVALID_WORKSPACE" as const,
  path: workspacePath,
});

const validatePnpmWorkspace = (contents: string, workspacePath: string) =>
  tryOrElse(
    () => invalidWorkspace(workspacePath),
    () => parseYaml(contents) as unknown,
  ).andThen((workspace) => {
    const parsedWorkspace = v.safeParse(PnpmWorkspaceSchema, workspace);
    return parsedWorkspace.success
      ? Result.ok(parsedWorkspace.output.packages)
      : Result.err(invalidWorkspace(workspacePath));
  });

const validatePackageJsonWorkspace = (contents: string, workspacePath: string) =>
  parseJson(contents)
    .mapErr(() => invalidWorkspace(workspacePath))
    .andThen((manifest) => {
      const parsedManifest = v.safeParse(PackageJsonWorkspaceSchema, manifest);
      if (!parsedManifest.success) return Result.err(invalidWorkspace(workspacePath));

      return Result.ok(
        Array.isArray(parsedManifest.output.workspaces)
          ? parsedManifest.output.workspaces
          : parsedManifest.output.workspaces.packages,
      );
    });

const readWorkspacePaths = (
  workspacePath: string,
  validate: (contents: string, workspacePath: string) => Result<string[], GetWorkspacePathsError>,
) =>
  readFileContents(workspacePath)
    .mapRejected(({ error }) => ({ type: "FAILED_TO_READ_WORKSPACE" as const, error }))
    .andThen((contents) => fromResult(validate(contents, workspacePath)));

export const getWorkspacePaths = (rootPath: string) =>
  fromResult(doesFileExist(path.join(rootPath, "pnpm-workspace.yaml")))
    .mapRejected(({ error }) => ({ type: "FAILED_TO_READ_WORKSPACE" as const, error }))
    .andThen((hasPnpmWorkspace) => {
      const pnpmWorkspacePath = path.join(rootPath, "pnpm-workspace.yaml");
      if (hasPnpmWorkspace) {
        return readWorkspacePaths(pnpmWorkspacePath, validatePnpmWorkspace);
      }

      const packageJsonPath = path.join(rootPath, "package.json");
      return fromResult(doesFileExist(packageJsonPath))
        .mapRejected(({ error }) => ({ type: "FAILED_TO_READ_WORKSPACE" as const, error }))
        .andThen((hasPackageJson) =>
          hasPackageJson
            ? readWorkspacePaths(packageJsonPath, validatePackageJsonWorkspace)
            : fromResult<string[], GetWorkspacePathsError>(
                Result.err({ type: "WORKSPACE_NOT_FOUND" }),
              ),
        );
    });

export const getRepoPackages = (absolutePathName: string) => {
  return getWorkspacePaths(absolutePathName)
    .andThen((patterns) =>
      fromPromise<Project[], GetRepoPackagesError>(
        findPackages(absolutePathName, {
          patterns,
          ignore: ["**/node_modules/**"],
          includeRoot: false,
        }),
        (error) => ({ type: "FIND_PACKAGES_FAILED", error }),
      ),
    )
    .map((projects) => projects.map(getPackageContext));
};

export const isPackageIgnored = (
  pkg: PackageManifestContext,
  repoPath: string,
  isIgnoredPath: picomatch.Matcher,
  isIgnoredPackage: picomatch.Matcher,
): boolean => {
  const relativePackagePath = path.relative(repoPath, pkg.packagePath).split(path.sep).join("/");

  return (
    isIgnoredPath(relativePackagePath) ||
    (pkg.packageName != null && isIgnoredPackage(pkg.packageName))
  );
};
