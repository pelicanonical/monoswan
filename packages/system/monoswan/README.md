# monoswan

monoswan keeps `package.json`, TypeScript, JSON, and text configuration consistent across a npm, pnpm, Yarn, or Bun monorepo. It also creates new workspace packages from reusable variants.

## Requirements

- Node.js 22.13 or newer
- a `pnpm-workspace.yaml` or a `workspaces` declaration in the root `package.json`
- packages with a `package.json` at the root of each package linted by monoswan

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

Workspace discovery supports pnpm workspace files, npm and Bun workspace arrays, and both Yarn
workspace forms, including modern Yarn Plug'n'Play installations. monoswan reads workspace
declarations directly instead of invoking the package manager.

## Quick start

Create `monoswan.config.ts` at the workspace root:

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

Select a variant in a workspace package's `package.json`:

```json
{
	"name": "@myrepo/example",
	"monoswan": {
		"variants": ["my-library"]
	}
}
```

Then check the workspace:

```sh
pnpm exec monoswan lint .
```

Use `pnpm exec monoswan lint . --fix` to apply available fixes.

## Commands

| Command                                               | Purpose                                                         |
| ----------------------------------------------------- | --------------------------------------------------------------- |
| `monoswan lint [path]`                                | Check workspace packages against configured rules and variants. |
| `monoswan init [path]`                                | Create an initial root configuration.                           |
| `monoswan print-config [path]`                        | Print a package's resolved variant configuration.               |
| `monoswan create-package <path> <name> <variants...>` | Create a package from variant templates.                        |

See the [complete documentation](https://monoswan.com/docs/) for configuration, built-in
rules, custom rules, templates, and command options.

## Support and stability

Report bugs through [GitHub issues](https://github.com/pelicanonical/monoswan/issues).

## License

[MIT](./LICENSE)
