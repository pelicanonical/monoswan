import { isEqual, isNotNil } from "es-toolkit";
import * as v from "valibot";
import type { LintRuleContext, LintRuleError } from "../types/rule.ts";
import type { JsonPointer } from "../types/utils.ts";
import { getPropertyFromPointer, stringifyJsonFormatted } from "../utils/json.ts";
import { getPackageJsonPath } from "../utils/paths.ts";
import { createRule } from "../utils/rule.ts";
import { writeFileContents } from "../utils/file.ts";
import type { SortOptions, CompareFn } from "./utils/sorting.ts";
import {
  DEFAULT_PACKAGE_JSON_SORT_OPTIONS,
  StringArraySchema,
  JsonArraySchema,
  JsonObjectSchema,
  getCompareFunction,
  sortJsonValue,
} from "./utils/sorting.ts";

export const sortPackageJson = createRule<SortOptions>(
  (options: SortOptions = DEFAULT_PACKAGE_JSON_SORT_OPTIONS) => ({
    name: "sort-package-json",
    check: (context) => getUnsortedProperties(context.packageJson, options, context),
  }),
);

const getUnsortedProperties = (
  value: unknown,
  options: SortOptions,
  context: LintRuleContext,
  locator: JsonPointer = [],
): LintRuleError[] => {
  if (v.is(StringArraySchema, value)) {
    return [maybeGetSortingError(value, options, context, locator)].filter(isNotNil);
  }

  if (v.is(JsonArraySchema, value)) {
    return value.flatMap((child, index) =>
      getUnsortedProperties(child, options, context, [...locator, index]),
    );
  }

  if (!v.is(JsonObjectSchema, value)) {
    return [];
  }

  const childErrors = Object.entries(value).flatMap(([key, child]) => {
    const childOptions = options.overrides?.[key] ?? options.children;
    return childOptions == null
      ? []
      : getUnsortedProperties(child, childOptions, context, [...locator, key]);
  });

  return [
    maybeGetSortingError(Object.keys(value), options, context, locator),
    ...childErrors,
  ].filter(isNotNil);
};

const maybeGetSortingError = (
  values: string[],
  options: SortOptions,
  context: LintRuleContext,
  locator: JsonPointer,
): LintRuleError | undefined => {
  const compare = getCompareFunction(options);

  if (compare == null || isEqual(values, values.toSorted(compare))) {
    return;
  }

  return createSortError({ locator, order: options.order, compare, context });
};

const createSortError = (options: {
  locator: JsonPointer;
  order: SortOptions["order"];
  compare: CompareFn;
  context: LintRuleContext;
}): LintRuleError => ({
  message: `${formatLocator(options.locator)} does not match ${options.order} sorting order`,
  packageContext: options.context,
  filePath: getPackageJsonPath(options.context.packagePath),
  locator: { type: "json", locator: options.locator },
  autofix: async (autofixContext) => {
    const manifest = structuredClone(autofixContext.packageJson);
    const current = getPropertyFromPointer(manifest, options.locator);
    const sorted = sortJsonValue(current, options.compare);

    if (sorted == null) {
      return;
    }

    if (options.locator.length === 0) {
      await writePackageManifest(autofixContext.packagePath, sorted);
      return;
    }

    const finalKey = options.locator.at(-1);
    const parent = getPropertyFromPointer(manifest, options.locator.slice(0, -1));

    if (typeof finalKey === "number" && v.is(JsonArraySchema, parent)) {
      parent[finalKey] = sorted;
      await writePackageManifest(autofixContext.packagePath, manifest);
    } else if (typeof finalKey === "string" && v.is(JsonObjectSchema, parent)) {
      parent[finalKey] = sorted;
      await writePackageManifest(autofixContext.packagePath, manifest);
    }
  },
});

const writePackageManifest = async (packagePath: string, manifest: unknown): Promise<void> => {
  const result = await writeFileContents(
    getPackageJsonPath(packagePath),
    stringifyJsonFormatted(manifest),
  );

  if (result.isErr) {
    throw result.error;
  }
};

const formatLocator = (locator: JsonPointer) =>
  locator.length === 0 ? "package.json" : locator.join(".");
