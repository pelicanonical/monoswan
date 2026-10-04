import { createTestMonorepo, type TestMonorepo } from "@monoswan/testing-utils";
import { execFileSync, spawnSync } from "node:child_process";
import { access, chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const packagePath = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
const cliPath = path.join(packagePath, "dist/cli.mjs");
const configModuleUrl = pathToFileURL(path.join(packagePath, "dist/config.mjs")).href;
const yarnCliPath = path.resolve(
	packagePath,
	"../../../node_modules/@yarnpkg/cli-dist/bin/yarn.js",
);
const projects: TestMonorepo[] = [];
const temporaryDirectories: string[] = [];

const createProject = async () => {
	const project = await createTestMonorepo({
		prefix: "monoswan cli test ",
		packages: [{ directory: "packages/example", name: "@example/package" }],
	});
	projects.push(project);
	return project;
};

const runCli = (cwd: string, ...args: string[]) =>
	spawnSync(process.execPath, [cliPath, ...args], {
		cwd,
		encoding: "utf8",
		env: { ...process.env, NO_COLOR: "1" },
	});

const writeConfig = (project: TestMonorepo, body: string) =>
	project.writeFile(
		"monoswan.config.ts",
		`import { defineConfig, sortPackageJson } from ${JSON.stringify(configModuleUrl)};\n\n${body}\n`,
	);

afterEach(async () => {
	await Promise.all([
		...projects.splice(0).map((project) => project.cleanup()),
		...temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { force: true, recursive: true })),
	]);
});

describe("built CLI", () => {
	it("initializes a configuration from a path containing spaces", async () => {
		const project = await createProject();
		const result = runCli(project.rootPath, "init", project.rootPath);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Created");
		expect(await project.readFile("monoswan.config.ts")).toContain("defineConfig");
	});

	it("lints, reports failures, and applies fixes", async () => {
		const project = await createProject();
		await writeConfig(project, `export default defineConfig({ rules: [sortPackageJson()] });`);
		const pkg = project.packages.get(path.normalize("packages/example"));
		expect(pkg).toBeDefined();
		await pkg?.writeFile(
			"package.json",
			'{"version":"0.0.0","name":"@example/package","private":true}\n',
		);

		const failingResult = runCli(project.rootPath, "lint", project.rootPath);
		expect(failingResult.status).toBe(1);
		expect(failingResult.stdout).toContain("does not match");

		const fixedResult = runCli(project.rootPath, "lint", project.rootPath, "--fix");
		expect(fixedResult.status).toBe(0);
		expect(fixedResult.stdout).toContain("Found 0 lint errors");
		expect(Object.keys((await pkg?.readPackageJson()) ?? {})).toEqual([
			"name",
			"version",
			"private",
		]);
	});

	it("prints the resolved configuration for a nested package path", async () => {
		const project = await createProject();
		await writeConfig(
			project,
			`export default defineConfig({ variants: { lib: { packageJson: { type: "module" } } } });`,
		);
		const pkg = project.packages.get(path.normalize("packages/example"));
		expect(pkg).toBeDefined();
		await pkg?.writePackageJson({
			name: "@example/package",
			version: "0.0.0",
			private: true,
			monoswan: { variants: ["lib"] },
		});
		await pkg?.writeFile("src/index.ts", "export {};\n");

		const result = runCli(project.rootPath, "print-config", pkg?.resolvePath("src") ?? "");
		expect(result.status).toBe(0);
		expect(JSON.parse(result.stdout)).toMatchObject({ packageJson: { type: "module" } });
	});

	it("rejects print-config paths in packages excluded from the workspace", async () => {
		const project = await createTestMonorepo({
			workspace: {
				packageManager: "pnpm",
				patterns: ["packages/*", "!packages/excluded"],
			},
			packages: [
				{ directory: "packages/included", name: "included" },
				{ directory: "packages/excluded", name: "excluded" },
			],
		});
		projects.push(project);
		await writeConfig(project, "export default defineConfig({});");
		const excludedPackage = project.packages.get(path.normalize("packages/excluded"));

		const result = runCli(project.rootPath, "print-config", excludedPackage?.rootPath ?? "");

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("Could not find a workspace package containing");
	});

	it("creates a package from variant initialization content", async () => {
		const project = await createProject();
		await writeConfig(
			project,
			`export default defineConfig({ variants: { lib: { packageJson: { type: "module" }, initialization: { additionalTextFiles: { "src/index.ts": "export {};\\n" } } } } });`,
		);
		const destination = project.resolvePath("packages/created package");

		const result = runCli(
			project.rootPath,
			"create-package",
			destination,
			"@example/created",
			"lib",
		);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Created @example/created");
		expect(
			JSON.parse(await readFile(path.join(destination, "package.json"), "utf8")),
		).toMatchObject({
			name: "@example/created",
			type: "module",
			monoswan: { variants: ["lib"] },
		});
		expect(await readFile(path.join(destination, "src/index.ts"), "utf8")).toBe("export {};\n");
	});

	it("returns non-zero statuses for invalid arguments and malformed configs", async () => {
		const project = await createProject();
		const invalidArguments = runCli(project.rootPath, "create-package");
		expect(invalidArguments.status).toBe(1);
		expect(invalidArguments.stderr).toContain("missing required argument");

		await project.writeFile("monoswan.config.ts", "export default {};\n");
		const malformedConfig = runCli(project.rootPath, "lint", project.rootPath);
		expect(malformedConfig.status).toBe(1);
		expect(malformedConfig.stderr).toContain("not a valid monoswan configuration");
	});

	it("preserves completed fixes when a later autofix fails", async () => {
		const project = await createProject();
		await project.writeFile(
			"monoswan.config.ts",
			`import { writeFile } from "node:fs/promises";
import { createRule, defineConfig } from ${JSON.stringify(configModuleUrl)};

const partialFix = createRule(() => ({
	name: "partial-fix",
	check: (context) => context.packageName === "@example/package" ? [
		{
			message: "write marker",
			packageContext: context,
			filePath: context.packagePath,
			autofix: () => writeFile(context.packagePath + "/fixed.txt", "fixed\\n"),
		},
		{
			message: "fail after marker",
			packageContext: context,
			filePath: context.packagePath,
			autofix: () => { throw new Error("intentional fix failure"); },
		},
	] : [],
}));

export default defineConfig({ rules: [partialFix()] });
`,
		);
		const pkg = project.packages.get(path.normalize("packages/example"));
		expect(pkg).toBeDefined();

		const result = runCli(project.rootPath, "lint", project.rootPath, "--fix");
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("Failed to run autofix");
		expect(await pkg?.readFile("fixed.txt")).toBe("fixed\n");
	});

	it("lints from a freshly installed Yarn Plug'n'Play package", { timeout: 30_000 }, async () => {
		const directory = await mkdtemp(path.join(tmpdir(), "monoswan-yarn-pnp-cli-"));
		temporaryDirectories.push(directory);
		const tarballDirectory = path.join(directory, "tarball");
		const consumerDirectory = path.join(directory, "consumer");
		await Promise.all([
			mkdir(tarballDirectory),
			mkdir(path.join(consumerDirectory, "packages/example"), { recursive: true }),
		]);
		const packOutput = execFileSync("pnpm", ["pack", "--pack-destination", tarballDirectory], {
			cwd: packagePath,
			encoding: "utf8",
		});
		const tarballPath = packOutput.trim().split("\n").at(-1);
		expect(tarballPath).toBeDefined();
		await Promise.all([
			writeFile(
				path.join(consumerDirectory, "package.json"),
				JSON.stringify({
					name: "yarn-consumer",
					private: true,
					packageManager: "yarn@4.18.1",
					workspaces: { packages: ["packages/*"] },
					dependencies: { monoswan: `file:${tarballPath}` },
				}),
			),
			writeFile(
				path.join(consumerDirectory, "packages/example/package.json"),
				JSON.stringify({
					name: "@example/yarn-pnp-package",
					private: true,
					monoswan: { variants: ["missing"] },
				}),
			),
			writeFile(
				path.join(consumerDirectory, "monoswan.config.mts"),
				'import { defineConfig } from "monoswan";\nexport default defineConfig({ variants: {} });\n',
			),
			writeFile(path.join(consumerDirectory, ".yarnrc.yml"), "nodeLinker: pnp\n"),
		]);
		const installResult = spawnSync(
			process.execPath,
			[yarnCliPath, "install", "--mode=skip-build", "--no-immutable"],
			{
				cwd: consumerDirectory,
				encoding: "utf8",
			},
		);
		expect(installResult.status, `${installResult.stdout}${installResult.stderr}`).toBe(0);

		const result = spawnSync(process.execPath, [yarnCliPath, "monoswan", "lint", "."], {
			cwd: consumerDirectory,
			encoding: "utf8",
			env: { ...process.env, NO_COLOR: "1" },
		});

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("references unknown variant: missing");
		await expect(access(path.join(consumerDirectory, ".pnp.cjs"))).resolves.toBeUndefined();
		await expect(access(path.join(consumerDirectory, "node_modules"))).rejects.toMatchObject({
			code: "ENOENT",
		});
	});

	it(
		"lints an npm workspace from a freshly installed package tarball",
		{ timeout: 20_000 },
		async () => {
			const directory = await mkdtemp(path.join(tmpdir(), "monoswan packed cli "));
			temporaryDirectories.push(directory);
			const tarballDirectory = path.join(directory, "tarball");
			const consumerDirectory = path.join(directory, "consumer");
			execFileSync("mkdir", [tarballDirectory, consumerDirectory]);
			const packOutput = execFileSync("pnpm", ["pack", "--pack-destination", tarballDirectory], {
				cwd: packagePath,
				encoding: "utf8",
			});
			const tarballPath = packOutput.trim().split("\n").at(-1);
			expect(tarballPath).toBeDefined();
			execFileSync("npm", ["init", "--yes"], { cwd: consumerDirectory, stdio: "ignore" });
			execFileSync("npm", ["install", tarballPath ?? "", "--ignore-scripts"], {
				cwd: consumerDirectory,
				stdio: "ignore",
			});
			const installedCli = path.join(consumerDirectory, "node_modules/.bin/monoswan");
			await chmod(installedCli, 0o755);

			expect(execFileSync(installedCli, ["--version"], { encoding: "utf8" }).trim()).toBe("0.0.1");

			await mkdir(path.join(consumerDirectory, "packages/example"), { recursive: true });
			await Promise.all([
				writeFile(
					path.join(consumerDirectory, "package.json"),
					JSON.stringify({ name: "npm-consumer", private: true, workspaces: ["packages/*"] }),
				),
				writeFile(
					path.join(consumerDirectory, "packages/example/package.json"),
					JSON.stringify({
						name: "@example/npm-package",
						private: true,
						monoswan: { variants: ["missing"] },
					}),
				),
				writeFile(
					path.join(consumerDirectory, "monoswan.config.mts"),
					'import { defineConfig } from "monoswan";\nexport default defineConfig({ variants: {} });\n',
				),
			]);

			const lintResult = spawnSync(installedCli, ["lint", "."], {
				cwd: consumerDirectory,
				encoding: "utf8",
				env: { ...process.env, NO_COLOR: "1" },
			});
			expect(lintResult.status).toBe(1);
			expect(lintResult.stderr).toContain("references unknown variant: missing");
		},
	);
});
