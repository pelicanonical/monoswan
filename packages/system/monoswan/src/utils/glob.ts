import picomatch from "picomatch";
import type Result from "true-myth/result";
import { tryOrElse } from "true-myth/result";

export const createGlobMatcher = <T extends boolean = false>(
	glob: picomatch.Glob,
	options?: picomatch.PicomatchOptions,
	returnState?: T,
): Result<
	T extends true ? picomatch.MatcherWithState : picomatch.Matcher,
	{ type: "FAILED_TO_CREATE_GLOB_MATCHER"; error: unknown }
> =>
	tryOrElse(
		(error) => ({ type: "FAILED_TO_CREATE_GLOB_MATCHER", error }),
		() => picomatch(glob, options, returnState),
	);
