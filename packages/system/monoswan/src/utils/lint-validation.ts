import { isDeepStrictEqual } from "node:util";
import type { LintRuleContext, LintRuleError } from "../types/rule.ts";
import type { JsonObject } from "../types/utils.ts";
import {
  doesFileExist,
  readFileContents,
  type DoesFileExistError,
  type ReadFileContentsError,
} from "./file.ts";
import { parseJson, type JsonParseError } from "./parse.ts";
import { Task } from "true-myth";
import { fromResult } from "true-myth/task";
import { diff } from "jest-diff";

const describePath = (path: Array<string | number>) =>
  path.length === 0 ? "the document" : path.map(String).join(".");

export const validateJson = (
  actual: unknown,
  expected: unknown,
  filePath: string,
  packageContext: LintRuleContext,
): LintRuleError[] => {
  const errors: LintRuleError[] = [];

  const visit = (actualValue: unknown, expectedValue: unknown, locator: Array<string | number>) => {
    if (
      expectedValue != null &&
      typeof expectedValue === "object" &&
      !Array.isArray(expectedValue) &&
      actualValue != null &&
      typeof actualValue === "object" &&
      !Array.isArray(actualValue)
    ) {
      for (const [key, value] of Object.entries(expectedValue)) {
        visit((actualValue as Record<string, unknown>)[key], value, [...locator, key]);
      }
    } else if (!isDeepStrictEqual(actualValue, expectedValue)) {
      errors.push({
        message: `${describePath(locator)} does not match variant\n${diff(actualValue, expectedValue)}`,
        filePath,
        locator: { type: "json", locator },
        packageContext,
      });
    }
  };

  visit(actual, expected, []);
  return errors;
};

export const validateJsonFile = (
  filePath: string,
  expected: JsonObject,
  packageContext: LintRuleContext,
): Task<LintRuleError[], ReadFileContentsError | DoesFileExistError | JsonParseError> =>
  fromResult(doesFileExist(filePath)).andThen((exists) =>
    exists
      ? readFileContents(filePath)
          .andThen((contents) => fromResult(parseJson(contents)))
          .map((json) => validateJson(json, expected, filePath, packageContext))
      : Task.resolve([getFileDoesNotExistRuleError(filePath, packageContext)]),
  );

export const validateTextFile = (
  filePath: string,
  expected: string,
  packageContext: LintRuleContext,
): Task<LintRuleError[], ReadFileContentsError | DoesFileExistError> =>
  fromResult(doesFileExist(filePath)).andThen((exists) =>
    exists
      ? readFileContents(filePath).map((content) =>
          content === expected
            ? []
            : [
                {
                  message: "File contents do not match the configured variant",
                  filePath,
                  packageContext,
                },
              ],
        )
      : Task.resolve([getFileDoesNotExistRuleError(filePath, packageContext)]),
  );

const getFileDoesNotExistRuleError = (filePath: string, packageContext: LintRuleContext) => ({
  message: "Expected file to exist",
  filePath,
  packageContext,
});
