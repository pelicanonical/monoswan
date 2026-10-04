import { describe, expect, it } from "vitest";
import type { PackageContext } from "../../types/context.ts";
import { resolvePackageVariants } from "../variants.ts";

const packageContext: PackageContext = {
  packageName: "example",
  packagePath: "/repo/packages/example",
};

describe("resolvePackageVariants", () => {
  it("merges static and context-based variants", () => {
    const result = resolvePackageVariants(
      ["base", "package"],
      {
        type: "monoswan-config",
        variants: {
          base: { packageJson: { scripts: { build: "tsc" } } },
          package: (context) => ({
            packageJson: { name: context.packageName, scripts: { test: "vitest" } },
          }),
        },
      },
      packageContext,
    );

    expect(result.isOk).toBe(true);
    if (result.isOk) {
      expect(result.value.packageJson).toEqual({
        name: "example",
        scripts: { build: "tsc", test: "vitest" },
      });
    }
  });

  it("reports every unknown variant", () => {
    const result = resolvePackageVariants(
      ["known", "missing", "also-missing"],
      { type: "monoswan-config", variants: { known: {} } },
      packageContext,
    );

    expect(result.isErr).toBe(true);
    if (result.isErr) {
      expect(result.error).toEqual({
        type: "INVALID_VARIANTS",
        packagePath: packageContext.packagePath,
        variantNames: ["missing", "also-missing"],
      });
    }
  });

  it("returns a typed error when a variant function throws", () => {
    const error = new Error("variant failed");
    const result = resolvePackageVariants(
      ["base", "package"],
      {
        type: "monoswan-config",
        variants: {
          base: {},
          package: () => {
            throw error;
          },
        },
      },
      packageContext,
    );

    expect(result.isErr).toBe(true);
    if (result.isOk) return;
    expect(result.error).toEqual({
      type: "VARIANT_CREATION_FAILED",
      packagePath: packageContext.packagePath,
      variantNames: ["base", "package"],
      error,
    });
  });
});
