import { describe, expect, it } from "vitest";
import {
  formatCreatePackageError,
  formatLintError,
  formatLintRuleIssue,
  formatPrintConfigError,
} from "../formatter.ts";

const packageContext = {
  packageName: "@myrepo/app",
  packagePath: "/repo/packages/app",
  packageJson: {},
  variant: {},
};

describe("formatLintRuleIssue", () => {
  it("formats an empty issue list", () => {
    expect(formatLintRuleIssue([])).toBe("Found 0 lint errors");
  });

  it("formats a single issue without an autofix", () => {
    const formatted = formatLintRuleIssue([
      {
        message: "Expected a license",
        packageContext,
        filePath: "/repo/packages/app/package.json",
      },
    ]);

    expect(formatted).toContain("@myrepo/app\n  • Expected a license");
    expect(formatted).not.toContain("Fix available");
    expect(formatted).toContain("Found 1 lint error");
  });

  it("groups multiple issues and marks available autofixes", () => {
    const formatted = formatLintRuleIssue([
      {
        message: "Expected a license",
        packageContext,
        filePath: "/repo/packages/app/package.json",
        autofix: async () => {},
      },
      {
        message: "Expected private package",
        packageContext: {
          packageName: undefined,
          packagePath: "/repo/packages/unnamed",
          packageJson: {},
          variant: {},
        },
        filePath: "/repo/packages/unnamed/package.json",
      },
    ]);

    expect(formatted).toContain("@myrepo/app\n  • Expected a license (⚙︎ Fix available)");
    expect(formatted).toContain("unnamed\n  • Expected private package");
    expect(formatted).toContain("Found 2 lint errors");
  });
});

describe("formatLintError", () => {
  it("formats errors without an underlying cause", () => {
    expect(formatLintError({ type: "CONFIG_NOT_FOUND" })).toBe(
      "Could not find a monoswan configuration.",
    );
    expect(formatLintError({ type: "NO_DEFAULT_EXPORT" })).toBe(
      "The monoswan configuration must have a default export.",
    );
    expect(formatLintError({ type: "INVALID_DEFAULT_EXPORT" })).toBe(
      "The default export is not a valid monoswan configuration.",
    );
  });

  it("includes the underlying error", () => {
    expect(formatLintError({ type: "CONFIG_LOAD_FAILED", cause: new Error("module failed") })).toBe(
      "Failed to load the monoswan configuration: module failed",
    );
    expect(formatLintError({ type: "FIND_PACKAGES_FAILED", error: new Error("scan failed") })).toBe(
      "Failed to find workspace packages: scan failed",
    );
    expect(formatLintError({ type: "INVALID_JSON", cause: new Error("bad JSON") })).toBe(
      "Failed to parse a package configuration: bad JSON",
    );
    expect(
      formatLintError({
        type: "FAILED_TO_CREATE_GLOB_MATCHER",
        error: new Error("bad glob"),
      }),
    ).toBe("Failed to create an ignore glob matcher: bad glob");
    expect(formatLintError({ type: "FAILED_TO_RUN_CHECK", error: new Error("check failed") })).toBe(
      "Failed to run a lint check: check failed",
    );
    expect(
      formatLintError({ type: "FAILED_TO_MERGE_VARIANT", error: new Error("merge failed") }),
    ).toBe("Failed to merge variant content: merge failed");
  });

  it("formats validation issues", () => {
    expect(
      formatLintError({
        type: "INVALID_PACKAGE_CONFIG",
        issues: [{ message: "Expected a string" }, { message: "Unknown variant" }],
      }),
    ).toBe("Invalid package configuration:\n  • Expected a string\n  • Unknown variant");
  });

  it("formats workspace discovery errors", () => {
    expect(formatLintError({ type: "WORKSPACE_NOT_FOUND" })).toBe(
      "Could not find a workspace declaration.",
    );
    expect(formatLintError({ type: "INVALID_WORKSPACE", path: "/repo/package.json" })).toBe(
      "Invalid workspace declaration at /repo/package.json.",
    );
    expect(
      formatLintError({
        type: "FAILED_TO_READ_WORKSPACE",
        error: new Error("read failed"),
      }),
    ).toBe("Failed to read the workspace declaration: read failed");
  });

  it("formats invalid variant names", () => {
    expect(
      formatLintError({
        type: "INVALID_VARIANTS",
        packagePath: "/repo/packages/app",
        variantNames: ["browser", "strict"],
      }),
    ).toBe("Package /repo/packages/app references unknown variants: browser, strict");
    expect(
      formatLintError({
        type: "VARIANT_CREATION_FAILED",
        packagePath: "/repo/packages/app",
        variantNames: ["browser"],
        error: new Error("variant failed"),
      }),
    ).toBe("Failed to create variant browser for package /repo/packages/app: variant failed");
  });

  it("formats file and autofix failures", () => {
    expect(formatLintError({ type: "FAILED_TO_READ_FILE", error: new Error("read failed") })).toBe(
      "Failed to read a file: read failed",
    );
    expect(
      formatLintError({
        type: "FAILED_FILE_EXISTENCE_CHECK",
        error: new Error("stat failed"),
      }),
    ).toBe("Failed to check whether a file exists: stat failed");
    expect(
      formatLintError({
        type: "AUTOFIX_FAILED",
        packagePath: "/repo/packages/app",
        error: new Error("fix failed"),
      }),
    ).toBe("Failed to run autofix at package /repo/packages/app: fix failed");
  });
});

describe("formatCreatePackage", () => {
  it("formats package creation errors", () => {
    expect(
      formatCreatePackageError({ type: "PACKAGE_ALREADY_EXISTS", path: "/repo/packages/app" }),
    ).toBe("A file or directory already exists at /repo/packages/app.");
    expect(
      formatCreatePackageError({ type: "INVALID_INITIALIZER_PATH", path: "../outside.txt" }),
    ).toBe("Initializer path must stay within the package: ../outside.txt");
    expect(
      formatCreatePackageError({ type: "CREATE_PACKAGE_FAILED", error: new Error("disk full") }),
    ).toBe("Failed to create the package: disk full");
    expect(
      formatCreatePackageError({
        type: "FAILED_TO_MERGE_VARIANT",
        error: new Error("merge failed"),
      }),
    ).toBe("Failed to merge variant content: merge failed");
  });

  it("formats configuration and variant errors", () => {
    expect(formatCreatePackageError({ type: "CONFIG_NOT_FOUND" })).toBe(
      "Could not find a monoswan configuration.",
    );
    expect(
      formatCreatePackageError({
        type: "CONFIG_LOAD_FAILED",
        cause: new Error("load failed"),
      }),
    ).toBe("Failed to load the monoswan configuration: load failed");
    expect(formatCreatePackageError({ type: "NO_DEFAULT_EXPORT" })).toBe(
      "The monoswan configuration must have a default export.",
    );
    expect(formatCreatePackageError({ type: "INVALID_DEFAULT_EXPORT" })).toBe(
      "The default export is not a valid monoswan configuration.",
    );
    expect(
      formatCreatePackageError({
        type: "INVALID_VARIANTS",
        packagePath: "/repo/packages/app",
        variantNames: ["missing"],
      }),
    ).toBe("Package /repo/packages/app references unknown variant: missing");
    expect(
      formatCreatePackageError({
        type: "INVALID_VARIANTS",
        packagePath: "/repo/packages/app",
        variantNames: ["first", "second"],
      }),
    ).toBe("Package /repo/packages/app references unknown variants: first, second");
    expect(
      formatCreatePackageError({
        type: "VARIANT_CREATION_FAILED",
        packagePath: "/repo/packages/app",
        variantNames: ["base", "app"],
        error: new Error("creation failed"),
      }),
    ).toBe("Failed to create variants base, app for package /repo/packages/app: creation failed");
    expect(
      formatCreatePackageError({
        type: "FAILED_FILE_EXISTENCE_CHECK",
        error: new Error("stat failed"),
      }),
    ).toBe("Failed to check whether the package exists: stat failed");
  });
});

describe("formatPrintConfig", () => {
  it("formats config lookup errors", () => {
    expect(formatPrintConfigError({ type: "PACKAGE_NOT_FOUND", path: "/repo/unknown" })).toBe(
      "Could not find a workspace package containing /repo/unknown.",
    );
    expect(
      formatPrintConfigError({ type: "FIND_PACKAGES_FAILED", error: new Error("scan failed") }),
    ).toBe("Failed to find workspace packages: scan failed");
    expect(
      formatPrintConfigError({
        type: "FAILED_TO_MERGE_VARIANT",
        error: new Error("merge failed"),
      }),
    ).toBe("Failed to merge variant content: merge failed");
  });

  it("formats configuration, package, and variant errors", () => {
    expect(formatPrintConfigError({ type: "CONFIG_NOT_FOUND" })).toBe(
      "Could not find a monoswan configuration.",
    );
    expect(
      formatPrintConfigError({ type: "CONFIG_LOAD_FAILED", cause: new Error("load failed") }),
    ).toBe("Failed to load the monoswan configuration: load failed");
    expect(formatPrintConfigError({ type: "NO_DEFAULT_EXPORT" })).toBe(
      "The monoswan configuration must have a default export.",
    );
    expect(formatPrintConfigError({ type: "INVALID_DEFAULT_EXPORT" })).toBe(
      "The default export is not a valid monoswan configuration.",
    );
    expect(
      formatPrintConfigError({
        type: "FAILED_FILE_EXISTENCE_CHECK",
        error: new Error("stat failed"),
      }),
    ).toBe("Failed to check whether a file exists: stat failed");
    expect(
      formatPrintConfigError({ type: "FAILED_TO_READ_FILE", error: new Error("read failed") }),
    ).toBe("Failed to read a package configuration: read failed");
    expect(formatPrintConfigError({ type: "INVALID_JSON", cause: new Error("bad JSON") })).toBe(
      "Failed to parse a package configuration: bad JSON",
    );
    expect(
      formatPrintConfigError({
        type: "INVALID_PACKAGE_CONFIG",
        issues: [{ message: "Expected a string" }],
      }),
    ).toBe("Invalid package configuration:\n  • Expected a string");
    expect(
      formatPrintConfigError({
        type: "INVALID_VARIANTS",
        packagePath: "/repo/packages/app",
        variantNames: ["first", "second"],
      }),
    ).toBe("Package /repo/packages/app references unknown variants: first, second");
    expect(
      formatPrintConfigError({
        type: "VARIANT_CREATION_FAILED",
        packagePath: "/repo/packages/app",
        variantNames: ["app"],
        error: new Error("creation failed"),
      }),
    ).toBe("Failed to create variant app for package /repo/packages/app: creation failed");
  });

  it("formats workspace discovery errors", () => {
    expect(formatPrintConfigError({ type: "WORKSPACE_NOT_FOUND" })).toBe(
      "Could not find a workspace declaration.",
    );
    expect(
      formatPrintConfigError({ type: "INVALID_WORKSPACE", path: "/repo/pnpm-workspace.yaml" }),
    ).toBe("Invalid workspace declaration at /repo/pnpm-workspace.yaml.");
    expect(
      formatPrintConfigError({
        type: "FAILED_TO_READ_WORKSPACE",
        error: new Error("read failed"),
      }),
    ).toBe("Failed to read the workspace declaration: read failed");
  });
});
