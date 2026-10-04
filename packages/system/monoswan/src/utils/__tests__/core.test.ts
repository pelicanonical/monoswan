import { createTestPackage, type TestPackage } from "@monoswan/testing-utils";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defineConfig } from "../../config.ts";
import {
  MONOSWAN_CONFIG_DISCRIMINATOR,
  findMonoswanConfig,
  isMonoswanConfigFilePath,
} from "../../utils.ts";
import { isAtLeastOneArray } from "../arrays.ts";
import { stringifyError } from "../error.ts";
import { readFileContents } from "../file.ts";
import { stringifyJsonFormatted } from "../json.ts";
import { parseJson } from "../parse.ts";
import { getPackageJsonPath, getTsconfigPath, resolveAbsolutePath } from "../paths.ts";
import { getRepoPackages } from "../repo.ts";

let project: TestPackage;

beforeEach(async () => {
  project = await createTestPackage();
});

afterEach(async () => {
  await project.cleanup();
});

describe("config helpers", () => {
  it("adds the config discriminator", () => {
    expect(defineConfig({ variants: { app: {} } })).toEqual({
      type: MONOSWAN_CONFIG_DISCRIMINATOR,
      variants: { app: {} },
    });
  });

  it.each(["monoswan.config.ts", "nested/monoswan.config.mts"])(
    "recognizes %s as a config file",
    (filePath) => expect(isMonoswanConfigFilePath(filePath)).toBe(true),
  );

  it("rejects unrelated config file names", () => {
    expect(isMonoswanConfigFilePath("monoswan.config.js")).toBe(false);
  });

  it("finds a config in an ancestor directory", async () => {
    await project.writeFile("monoswan.config.mts", "export default {};");
    const nestedPath = project.resolvePath("packages", "app", "src");

    const result = findMonoswanConfig(nestedPath);

    expect(result.isOk).toBe(true);
    if (result.isOk) expect(result.value).toBe(project.resolvePath("monoswan.config.mts"));
  });

  it("returns CONFIG_NOT_FOUND when no ancestor contains a config", () => {
    const result = findMonoswanConfig(project.rootPath);

    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toEqual({ type: "CONFIG_NOT_FOUND" });
  });
});

describe("small utilities", () => {
  it("detects non-empty arrays", () => {
    expect(isAtLeastOneArray([])).toBe(false);
    expect(isAtLeastOneArray([1])).toBe(true);
  });

  it("formats errors and non-error values", () => {
    expect(stringifyError(new Error("boom"))).toBe("boom");
    expect(stringifyError({ reason: "boom" })).toBe('{\n  "reason": "boom"\n}');
    expect(stringifyJsonFormatted({ value: true })).toBe('{\n  "value": true\n}');
  });

  it("parses JSONC with comments and trailing commas and rejects invalid input", () => {
    const valid = parseJson('{"enabled":true}');
    const jsonc = parseJson(`{
			// JSONC comment
			"enabled": true,
		}`);
    const invalid = parseJson("not json");

    expect(valid.isOk).toBe(true);
    if (valid.isOk) expect(valid.value).toEqual({ enabled: true });
    expect(jsonc.isOk).toBe(true);
    if (jsonc.isOk) expect(jsonc.value).toEqual({ enabled: true });
    expect(invalid.isErr).toBe(true);
    if (invalid.isErr) expect(invalid.error).toMatchObject({ type: "FAILED_TO_PARSE_JSON" });
  });

  it("builds standard paths", () => {
    expect(getPackageJsonPath(project.rootPath)).toBe(project.resolvePath("package.json"));
    expect(getTsconfigPath(project.rootPath)).toBe(project.resolvePath("tsconfig.json"));
    expect(resolveAbsolutePath("relative/file.ts")).toBe(
      path.resolve(process.cwd(), "relative/file.ts"),
    );
  });

  it("reads files into resolved tasks and maps read failures", async () => {
    await project.writeFile("message.txt", "hello");

    const success = await readFileContents(project.resolvePath("message.txt"));
    const failure = await readFileContents(project.resolvePath("missing.txt"));

    expect(success.isOk).toBe(true);
    if (success.isOk) expect(success.value).toBe("hello");
    expect(failure.isErr).toBe(true);
    if (failure.isErr) expect(failure.error).toMatchObject({ type: "FAILED_TO_READ_FILE" });
  });

  it("reports a missing workspace declaration", async () => {
    const result = await getRepoPackages("\0");

    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toMatchObject({ type: "WORKSPACE_NOT_FOUND" });
  });
});
