import path from "node:path";
import type { Task } from "true-myth";
import { Result } from "true-myth";
import { fromResult } from "true-myth/task";
import {
	createDirectory,
	writeFileContents,
	type CreateDirectoryError,
	type DoesFileExistError,
	type WriteFileContentsError,
} from "./utils/file.ts";
import { findMonoswanConfig } from "./utils.ts";

export type InitializeConfigError =
	| { type: "CONFIG_ALREADY_EXISTS"; path: string }
	| CreateDirectoryError
	| DoesFileExistError
	| WriteFileContentsError;

const INITIAL_CONFIG = `import { defineConfig, enforceVariants, sortPackageJson } from "monoswan";

export default defineConfig({
	variants: {
		lib: {},
	},
	rules: [enforceVariants(), sortPackageJson()],
});
`;

export const initializeConfig = (directoryPath: string): Task<string, InitializeConfigError> => {
	const absoluteDirectoryPath = path.resolve(directoryPath);
	const configPath = path.join(absoluteDirectoryPath, "monoswan.config.ts");
	const existingConfig = findMonoswanConfig(absoluteDirectoryPath);
	const availableConfigPath = getAvailableConfigPath(existingConfig, configPath);

	return fromResult(availableConfigPath)
		.andThen(() => createDirectory(absoluteDirectoryPath))
		.andThen(() => writeFileContents(configPath, INITIAL_CONFIG))
		.map(() => configPath);
};

const getAvailableConfigPath = (
	existingConfig: ReturnType<typeof findMonoswanConfig>,
	configPath: string,
): Result<string, { type: "CONFIG_ALREADY_EXISTS"; path: string } | DoesFileExistError> => {
	if (existingConfig.isOk) {
		return Result.err({ type: "CONFIG_ALREADY_EXISTS", path: existingConfig.value });
	}

	if (existingConfig.error.type === "CONFIG_NOT_FOUND") {
		return Result.ok(configPath);
	}

	return Result.err(existingConfig.error);
};
