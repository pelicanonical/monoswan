import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type Result from "true-myth/result";
import { tryOrElse } from "true-myth/result";
import type Task from "true-myth/task";
import { safelyTry } from "true-myth/task";

export interface ReadFileContentsError {
  type: "FAILED_TO_READ_FILE";
  error: unknown;
}

export const readFileContents = (path: string): Task<string, ReadFileContentsError> =>
  safelyTry(() => readFile(path, { encoding: "utf8" })).mapRejected((error) => ({
    type: "FAILED_TO_READ_FILE",
    error,
  }));

export interface WriteFileContentsError {
  type: "FAILED_TO_WRITE_FILE";
  error: unknown;
}

export const writeFileContents = (
  path: string,
  contents: string,
): Task<void, WriteFileContentsError> =>
  safelyTry(() => writeFile(path, contents)).mapRejected((error) => ({
    type: "FAILED_TO_WRITE_FILE",
    error,
  }));

export interface CreateDirectoryError {
  type: "FAILED_TO_CREATE_DIRECTORY";
  error: unknown;
}

export const createDirectory = (path: string): Task<void, CreateDirectoryError> =>
  safelyTry(() => mkdir(path, { recursive: true }))
    .map(() => undefined)
    .mapRejected((error) => ({ type: "FAILED_TO_CREATE_DIRECTORY", error }));

export interface DoesFileExistError {
  type: "FAILED_FILE_EXISTENCE_CHECK";
  error: unknown;
}

export const doesFileExist = (path: string): Result<boolean, DoesFileExistError> =>
  tryOrElse(
    (error) => ({ type: "FAILED_FILE_EXISTENCE_CHECK", error }),
    () => existsSync(path),
  );
