#!/usr/bin/env node

import { Option, program } from "commander";
import path from "node:path";
import { Result } from "true-myth";
import { all, fromResult } from "true-myth/task";
import packageJson from "../package.json" with { type: "json" };
import { lint } from "./lint.ts";
import { loadMonoswanConfig } from "./loader.ts";
import { findMonoswanConfig } from "./utils.ts";
import { resolveAbsolutePath } from "./utils/paths.ts";
import { getRepoPackages } from "./utils/repo.ts";
import { getResolvedPackageVariant } from "./utils/variants.ts";
import { stringifyJsonFormatted } from "./utils/json.ts";
import { autofixAll } from "./autofix.ts";
import {
  formatCreatePackageError,
  formatLintError,
  formatLintRuleIssue,
  formatPrintConfigError,
} from "./utils/formatter.ts";
import { createPackageFromVariants, type PackageConfigLocation } from "./create-package.ts";
import { initializeConfig } from "./initialize-config.ts";
import { stringifyError } from "./utils/error.ts";

interface CliOptions {
  silent: boolean;
}

interface LintOptions extends CliOptions {
  fix: boolean;
}

interface CreatePackageOptions extends CliOptions {
  config: PackageConfigLocation;
}

const lintPackages = (path: string, options: LintOptions): void => {
  const absolutePath = resolveAbsolutePath(path);
  const lintTask = lint(absolutePath);
  const task = options.fix
    ? lintTask.andThen((errors) => autofixAll(errors)).andThen(() => lint(absolutePath))
    : lintTask;

  task.match({
    Resolved: (errors) => {
      if (errors.length > 0) {
        process.exitCode = 1;
      }

      if (!options.silent) {
        console.log(formatLintRuleIssue(errors));
      }
    },
    Rejected: (reason) => {
      if (!options.silent) {
        console.error(formatLintError(reason));
      }
      process.exitCode = 1;
    },
  });
};

const printConfig = (inputPath: string): void => {
  const absolutePath = resolveAbsolutePath(inputPath);

  fromResult(findMonoswanConfig(absolutePath))
    .andThen((configPath) =>
      all([loadMonoswanConfig(configPath), getRepoPackages(path.dirname(configPath))]),
    )
    .andThen(([config, packages]) => {
      const pkg = packages
        .filter((candidate) => {
          const relativePath = path.relative(candidate.packagePath, absolutePath);
          return (
            relativePath === "" ||
            (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
          );
        })
        .toSorted((left, right) => right.packagePath.length - left.packagePath.length)[0];

      if (pkg == null) {
        return fromResult(Result.err({ type: "PACKAGE_NOT_FOUND", path: absolutePath } as const));
      }

      return getResolvedPackageVariant(pkg, config);
    })
    .match({
      Resolved: (config) => {
        console.log(stringifyJsonFormatted(config));
      },
      Rejected: (reason) => {
        console.error(formatPrintConfigError(reason));
        process.exitCode = 1;
      },
    });
};

const initializeConfigCommand = (inputPath: string): void => {
  initializeConfig(resolveAbsolutePath(inputPath)).match({
    Resolved: (configPath) => {
      console.log(`Created ${configPath}`);
    },
    Rejected: (reason) => {
      console.error(
        reason.type === "CONFIG_ALREADY_EXISTS"
          ? `A monoswan configuration already exists at ${reason.path}.`
          : `Failed to create the monoswan configuration: ${stringifyError(reason.error)}`,
      );
      process.exitCode = 1;
    },
  });
};

const createPackage = (
  inputPath: string,
  packageName: string,
  variantNames: string[],
  options: CreatePackageOptions,
): void => {
  createPackageFromVariants(
    resolveAbsolutePath(inputPath),
    packageName,
    variantNames,
    options.config,
  ).match({
    Resolved: () => {
      if (!options.silent) {
        console.log(`Created ${packageName} at ${resolveAbsolutePath(inputPath)}`);
      }
    },
    Rejected: (reason) => {
      if (!options.silent) {
        console.error(formatCreatePackageError(reason));
      }
      process.exitCode = 1;
    },
  });
};

program.name("monoswan").description("Manage monorepos with monoswan").version(packageJson.version);

program
  .command("lint")
  .description("lint a monorepo")
  .argument("[path]", "path to the monorepo", ".")
  .option("--silent", "do not display diagnostics")
  .option("--fix", "run autofixes")
  .action(lintPackages);

program
  .command("create-package")
  .description("create a new package from variants")
  .argument("<path>", "path where the package will be created")
  .argument("<package-name>", "package name")
  .argument("<variants...>", "variant names, merged in the provided order")
  .addOption(
    new Option("--config <location>", "where to store the package's monoswan config")
      .choices(["package-json", "standalone"])
      .default("package-json"),
  )
  .option("--silent", "do not display output")
  .action(createPackage);

program
  .command("init")
  .description("initialize monoswan.config.ts with default values")
  .argument("[path]", "path to the monorepo", ".")
  .action(initializeConfigCommand);

program
  .command("print-config")
  .description("print the resolved configuration")
  .argument("[path]", "path to the monorepo", ".")
  .action(printConfig);

program.parse();
