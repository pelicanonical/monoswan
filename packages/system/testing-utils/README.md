# @monoswan/testing-utils

Temporary-project helpers for testing packages and multi-package workspaces.

## Workspace fixtures

`createTestMonorepo` creates an isolated directory and writes the workspace declaration for the
selected package manager. pnpm is the default.

```ts
const project = await createTestMonorepo({
  workspace: {
    packageManager: "npm",
    patterns: ["packages/*", "tests/*", "!packages/legacy"],
  },
  packages: [
    { name: "library", directory: "packages/library" },
    { name: "integration-app", directory: "tests/integration-app" },
  ],
});

try {
  await project.addPackage({ name: "new-package" });
  await project.writeFile("monoswan.config.ts", "export default {};\n");
} finally {
  await project.cleanup();
}
```

Supported `packageManager` values are `pnpm`, `npm`, `yarn`, and `bun`. Yarn fixtures use the
workspace array by default; pass `workspaceFormat: "object"` for the Yarn Classic object form.

The returned fixture exposes normalized `workspace` metadata, its packages by normalized relative
path, path-safe file helpers, and an idempotent `cleanup` function. Tests should always call
`cleanup`, preferably from `finally` or the test framework's teardown hook.

## Single-package fixtures

Use `createTestPackage` when no workspace declaration is needed. It provides the same path-safe
file API plus `readPackageJson` and `writePackageJson` helpers.
