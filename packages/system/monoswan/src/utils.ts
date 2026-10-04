import path from "node:path";
import { Result } from "true-myth";
import { doesFileExist, type DoesFileExistError } from "./utils/file.ts";

export const MONOSWAN_CONFIG_DISCRIMINATOR = "monoswan-config";
const CONFIG_FILE_NAMES = ["monoswan.config.ts", "monoswan.config.mts"];

export const isMonoswanConfigFilePath = (filePath: string) => {
	return CONFIG_FILE_NAMES.some((fileName) => filePath.endsWith(fileName));
};

export const findMonoswanConfig = (
	pathName: string,
): Result<string, { type: "CONFIG_NOT_FOUND" } | DoesFileExistError> => {
	const configPaths: string[] = [];

	for (let dir = path.resolve(pathName); dir !== path.dirname(dir); dir = path.dirname(dir)) {
		for (const cfg of CONFIG_FILE_NAMES) {
			configPaths.push(path.join(dir, cfg));
		}
	}

	return findExistingConfig(configPaths);
};

const findExistingConfig = ([configPath, ...remainingPaths]: string[]): Result<
	string,
	{ type: "CONFIG_NOT_FOUND" } | DoesFileExistError
> => {
	if (configPath == null) {
		return Result.err({ type: "CONFIG_NOT_FOUND" });
	}

	return doesFileExist(configPath).andThen((exists) =>
		exists ? Result.ok(configPath) : findExistingConfig(remainingPaths),
	);
};
