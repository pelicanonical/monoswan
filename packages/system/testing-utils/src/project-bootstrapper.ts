import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export type JsonObject = Record<string, unknown>;

interface FixtureFiles {
	files?: Record<string, string>;
	jsonFiles?: Record<string, unknown>;
}

export interface TestDirectory {
	readonly rootPath: string;
	resolvePath: (...segments: string[]) => string;
	writeFile: (relativePath: string, contents: string) => Promise<void>;
	writeJson: (relativePath: string, value: unknown) => Promise<void>;
	fileExists: (relativePath: string) => Promise<boolean>;
	readFile: (relativePath: string) => Promise<string>;
	readJson: <T = unknown>(relativePath: string) => Promise<T>;
	cleanup: () => Promise<void>;
}

export interface TestPackage extends TestDirectory {
	readonly packageJsonPath: string;
	readPackageJson: <T extends JsonObject = JsonObject>() => Promise<T>;
	writePackageJson: (manifest: JsonObject) => Promise<void>;
}

export interface TestPackageOptions extends FixtureFiles {
	prefix?: string;
	name?: string;
	manifest?: JsonObject;
}

type MonorepoPackageLocation =
	| { name: string; directory?: string }
	| { name?: string; directory: string };

export type TestMonorepoPackageOptions = Omit<TestPackageOptions, "prefix" | "name"> &
	MonorepoPackageLocation;

export type TestWorkspaceOptions =
	| { packageManager: "pnpm"; patterns?: readonly string[] }
	| { packageManager: "npm" | "bun"; patterns?: readonly string[] }
	| {
			packageManager: "yarn";
			patterns?: readonly string[];
			workspaceFormat?: "array" | "object";
	  };

export interface TestWorkspace {
	readonly packageManager: TestWorkspaceOptions["packageManager"];
	readonly patterns: readonly string[];
	readonly declarationPath: "package.json" | "pnpm-workspace.yaml";
}

export interface TestMonorepoOptions extends FixtureFiles {
	prefix?: string;
	name?: string;
	manifest?: JsonObject;
	workspace?: TestWorkspaceOptions;
	packages?: TestMonorepoPackageOptions[];
}

export interface TestMonorepo extends TestDirectory {
	readonly packages: ReadonlyMap<string, TestPackage>;
	readonly workspace: TestWorkspace;
	addPackage: (options: TestMonorepoPackageOptions) => Promise<TestPackage>;
}

const createDirectory = (rootPath: string, cleanup: () => Promise<void>): TestDirectory => {
	const resolvePath = (...segments: string[]) => {
		const resolvedPath = path.resolve(rootPath, ...segments);

		if (resolvedPath !== rootPath && !resolvedPath.startsWith(`${rootPath}${path.sep}`)) {
			throw new Error(`Project path must remain within ${rootPath}`);
		}

		return resolvedPath;
	};
	const writeProjectFile = async (relativePath: string, contents: string) => {
		const filePath = resolvePath(relativePath);
		await mkdir(path.dirname(filePath), { recursive: true });
		await writeFile(filePath, contents);
	};

	return {
		rootPath,
		resolvePath,
		writeFile: writeProjectFile,
		writeJson: (relativePath, value) =>
			writeProjectFile(relativePath, JSON.stringify(value, null, 2)),
		fileExists: async (relativePath) => {
			try {
				await access(resolvePath(relativePath));
				return true;
			} catch (error) {
				if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
				throw error;
			}
		},
		readFile: (relativePath) => readFile(resolvePath(relativePath), "utf8"),
		readJson: async <T = unknown>(relativePath: string) =>
			JSON.parse(await readFile(resolvePath(relativePath), "utf8")) as T,
		cleanup,
	};
};

const writeFixtureFiles = async (directory: TestDirectory, options: FixtureFiles) => {
	for (const [filePath, value] of Object.entries(options.jsonFiles ?? {})) {
		await directory.writeJson(filePath, value);
	}

	for (const [filePath, contents] of Object.entries(options.files ?? {})) {
		await directory.writeFile(filePath, contents);
	}
};

const createPackageAt = async (
	rootPath: string,
	options: TestPackageOptions,
	defaultName: string,
): Promise<TestPackage> => {
	await mkdir(rootPath, { recursive: true });
	const directory = createDirectory(rootPath, () => rm(rootPath, { force: true, recursive: true }));
	const packageJsonPath = directory.resolvePath("package.json");
	const manifest = {
		version: "0.0.0",
		private: true,
		...options.manifest,
		name: options.name ?? options.manifest?.name ?? defaultName,
	};
	const testPackage: TestPackage = {
		...directory,
		packageJsonPath,
		readPackageJson: <T extends JsonObject = JsonObject>() => directory.readJson<T>("package.json"),
		writePackageJson: (value) => directory.writeJson("package.json", value),
	};

	await writeFixtureFiles(testPackage, options);
	await testPackage.writePackageJson(manifest);
	return testPackage;
};

export const createTestPackage = async (options: TestPackageOptions = {}): Promise<TestPackage> => {
	const rootPath = await mkdtemp(path.join(tmpdir(), options.prefix ?? "monoswan-test-package-"));
	return createPackageAt(rootPath, options, "test-package");
};

const stringifyPnpmWorkspace = (patterns: readonly string[]) =>
	`packages:\n${patterns.map((pattern) => `  - ${JSON.stringify(pattern)}`).join("\n")}\n`;

const DEFAULT_WORKSPACE: TestWorkspaceOptions = { packageManager: "pnpm" };
const DEFAULT_WORKSPACE_PATTERNS = ["packages/*"];

export const createTestMonorepo = async (
	options: TestMonorepoOptions = {},
): Promise<TestMonorepo> => {
	const rootPath = await mkdtemp(path.join(tmpdir(), options.prefix ?? "monoswan-test-monorepo-"));
	const directory = createDirectory(rootPath, () => rm(rootPath, { force: true, recursive: true }));
	const workspaceOptions = options.workspace ?? DEFAULT_WORKSPACE;
	const workspacePatterns = workspaceOptions.patterns ?? DEFAULT_WORKSPACE_PATTERNS;
	const workspace: TestWorkspace = {
		packageManager: workspaceOptions.packageManager,
		patterns: workspacePatterns,
		declarationPath:
			workspaceOptions.packageManager === "pnpm" ? "pnpm-workspace.yaml" : "package.json",
	};
	const packages = new Map<string, TestPackage>();
	const addPackage = async (packageOptions: TestMonorepoPackageOptions) => {
		const packageName =
			packageOptions.name ??
			(packageOptions.directory == null ? undefined : path.basename(packageOptions.directory));

		if (packageName == null || packageName.length === 0) {
			throw new Error("A test package requires a name or directory");
		}

		const relativeDirectory = packageOptions.directory ?? path.join("packages", packageName);
		const normalizedDirectory = path.normalize(relativeDirectory);
		const testPackage = await createPackageAt(
			directory.resolvePath(normalizedDirectory),
			packageOptions,
			packageName,
		);
		packages.set(normalizedDirectory, testPackage);
		return testPackage;
	};
	const monorepo: TestMonorepo = { ...directory, packages, workspace, addPackage };

	await writeFixtureFiles(monorepo, options);
	const packageJsonWorkspace =
		workspaceOptions.packageManager === "pnpm"
			? {}
			: {
					workspaces:
						workspaceOptions.packageManager === "yarn" &&
						workspaceOptions.workspaceFormat === "object"
							? { packages: workspacePatterns }
							: workspacePatterns,
				};
	await monorepo.writeJson("package.json", {
		version: "0.0.0",
		private: true,
		...packageJsonWorkspace,
		...options.manifest,
		name: options.name ?? options.manifest?.name ?? "test-monorepo",
	});
	if (workspaceOptions.packageManager === "pnpm") {
		await monorepo.writeFile("pnpm-workspace.yaml", stringifyPnpmWorkspace(workspacePatterns));
	}

	for (const packageOptions of options.packages ?? []) {
		await addPackage(packageOptions);
	}

	return monorepo;
};
