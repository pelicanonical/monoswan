<p align="center">
  <img src="./apps/site/src/assets/monoswan3.png" alt="monoswan" width="420" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/monoswan"><img src="https://img.shields.io/npm/v/monoswan?label=npm" alt="npm version" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license" /></a>
</p>

<p align="center">
  <a href="https://monoswan.com">Website</a> ·
  <a href="https://monoswan.com/docs">Documentation</a>
</p>

<h1 align="center">monoswan</h1>

<p align="center"><strong>pleasant monorepos</strong></p>

monoswan keeps package configuration consistent across a monorepo. Define shared package
shapes once, check them with rules, and use the same definitions to create new packages.
It discovers packages from pnpm, npm, Yarn, and Bun workspace declarations.

- **Centrally managed configuration:** Share `package.json`, TypeScript, JSON, and text
  configuration through composable variants.
- **Rules and consistency:** Check packages with built-in or custom rules, with autofix
  support.
- **Package templates:** Create packages from variant defaults and initialization content.

## Quick start prompt

Copy this prompt into your coding agent:

```text
monoswan is a monorepo management tool to help keep your package.json, tsconfig.json, and other standard files consistent across packages in a monorepo. Set up monoswan in this monorepo, you can view the full documentation at monoswan.com/llms.txt. Inspect the workspace first so you can preserve its package manager, structure, and existing conventions. Install monoswan as a development dependency at the workspace root, run its init command, then review the workspace packages and define practical variants in monoswan.config.ts for their shared package.json, TypeScript, JSON, and text-file configuration. Assign the appropriate variant or variants to each package, run the monoswan linter, fix any issues it reports without changing unrelated behavior, and summarize the configuration and files you changed.
```

## Requirements

- Node.js 22.13 or newer
- A `pnpm-workspace.yaml` or a `workspaces` declaration in the root `package.json`

## Install

Install monoswan at the workspace root.

```sh
# pnpm
pnpm add -D -w monoswan

# npm
npm install -D monoswan

# yarn
yarn add -D -W monoswan

# bun
bun add -D monoswan
```

Initialize a configuration:

```sh
pnpm exec monoswan init
```

Use `npx monoswan`, `yarn monoswan`, or `bunx monoswan` in the commands below when using a
different package manager.

Workspace discovery supports pnpm workspace files, npm and Bun workspace arrays, and both Yarn
workspace forms, including modern Yarn Plug'n'Play installations. monoswan reads workspace
declarations directly and does not invoke the package manager during discovery.

Then describe a shared package shape in `monoswan.config.ts`:

```ts
import { defineConfig, enforceVariants, sortPackageJson } from "monoswan";

export default defineConfig({
	variants: {
		"my-library": {
			packageJson: { type: "module" },
			tsConfig: { compilerOptions: { strict: true } },
		},
	},
	rules: [enforceVariants(), sortPackageJson()],
});
```

Assign the variant to a workspace package:

```json
{
	"name": "@myrepo/example",
	"monoswan": {
		"variants": ["my-library"]
	}
}
```

Check the workspace:

```sh
pnpm exec monoswan lint .
```

## Commands

| Command                                               | Purpose                                                           |
| ----------------------------------------------------- | ----------------------------------------------------------------- |
| `monoswan lint [path]`                                | Check workspace packages and optionally apply fixes with `--fix`. |
| `monoswan init [path]`                                | Create an initial `monoswan.config.ts`.                           |
| `monoswan print-config [path]`                        | Print the resolved configuration for a package.                   |
| `monoswan create-package <path> <name> <variants...>` | Generate a package from variant templates.                        |

Run `pnpm exec monoswan <command> --help` for complete command syntax.

## Documentation and support

Full documentation is available at [monoswan.com/docs](https://monoswan.com/docs/).
Report bugs and request features through the project's
[GitHub issues](https://github.com/pelicanonical/monoswan/issues).

## Development

This repository uses pnpm and pins the contributor runtime in `package.json`.

```sh
pnpm install
pnpm lint
pnpm check
pnpm test
pnpm build
```

## License

[MIT](./LICENSE)
