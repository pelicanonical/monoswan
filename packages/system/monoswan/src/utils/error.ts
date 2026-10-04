import { stringifyJsonFormatted } from "./json.ts";

export const stringifyError = (error: unknown) =>
  error instanceof Error ? error.message : stringifyJsonFormatted(error);
