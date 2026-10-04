import type { JsonPointer } from "../types/utils.ts";

export const stringifyJsonFormatted = (json: unknown) => JSON.stringify(json, null, 2);

export const getPropertyFromPointer = (value: unknown, ptr: JsonPointer): unknown => {
	let current = value;

	for (const segment of ptr) {
		if (current === null || typeof current !== "object") {
			return undefined;
		}

		if (!Object.prototype.hasOwnProperty.call(current, segment)) {
			return undefined;
		}

		current = (current as Record<PropertyKey, unknown>)[segment];
	}

	return current;
};
