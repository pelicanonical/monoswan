import { Task } from "true-myth";
import { fromPromise, fromResult } from "true-myth/task";
import type { MonoswanConfig } from "./types/root-config.ts";
import { findMonoswanConfig, MONOSWAN_CONFIG_DISCRIMINATOR } from "./utils.ts";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
	moduleCache: false,
	fsCache: false,
});

export type LoadMonoswanConfigError =
	| { type: "CONFIG_LOAD_FAILED"; cause: unknown }
	| { type: "NO_DEFAULT_EXPORT" }
	| { type: "INVALID_DEFAULT_EXPORT" };

export const getMonoswanConfig = (absolutePath: string) =>
	fromResult(findMonoswanConfig(absolutePath)).andThen(loadMonoswanConfig);

export const loadMonoswanConfig = (
	filename: string,
): Task<MonoswanConfig, LoadMonoswanConfigError> =>
	fromPromise<unknown, LoadMonoswanConfigError>(
		jiti.import(filename, { default: true }),
		(cause) => ({ type: "CONFIG_LOAD_FAILED", cause }),
	).andThen((module) => {
		if (module == null) {
			return Task.reject({ type: "NO_DEFAULT_EXPORT" });
		}

		if (!isMonoswanConfig(module)) {
			return Task.reject({ type: "INVALID_DEFAULT_EXPORT" });
		}

		return Task.resolve(module);
	});

// TODO: fully validate the config
const isMonoswanConfig = (obj: unknown): obj is MonoswanConfig => {
	return (
		obj != null &&
		typeof obj === "object" &&
		"type" in obj &&
		obj.type === MONOSWAN_CONFIG_DISCRIMINATOR
	);
};
