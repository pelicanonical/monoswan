import type { Result } from "true-myth";
import { Result as ResultValue } from "true-myth";
import { parse, printParseErrorCode, type ParseError } from "jsonc-parser";

export interface JsonParseError {
	type: "FAILED_TO_PARSE_JSON";
	error: unknown;
}

export const parseJson = (content: string): Result<unknown, JsonParseError> => {
	const errors: ParseError[] = [];
	const value = parse(content, errors, { allowTrailingComma: true });

	if (errors.length === 0) {
		return ResultValue.ok(value);
	}

	const message = errors
		.map(({ error, offset }) => `${printParseErrorCode(error)} at offset ${offset}`)
		.join(", ");
	return ResultValue.err({
		type: "FAILED_TO_PARSE_JSON",
		error: new SyntaxError(`Failed to parse JSONC: ${message}`),
	});
};
