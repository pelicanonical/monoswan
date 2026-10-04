import { sortKeys } from "es-toolkit";
import * as v from "valibot";

export type CompareFn = (keyA: string, keyB: string) => number;

type SortOrder =
	| { order: "alphabetical" }
	| {
			order: "fixed";
			keys: readonly string[];
			/**
			 *
			 * If the key does not exist in `keys`, sorts it in this order
			 * at the end
			 *
			 * @default alphabetical
			 */
			fallbackCompare?: CompareFn;
	  }
	| { order: "custom"; compare: CompareFn }
	| { order: "none" };

export type SortOptions = SortOrder & {
	children?: SortOptions;
	overrides?: Readonly<Record<string, SortOptions>>;
};

export const JsonArraySchema = v.array(v.unknown());
export const JsonObjectSchema = v.record(v.string(), v.unknown());
export const StringArraySchema = v.array(v.string());

const alphabetize: CompareFn = (keyA, keyB) => {
	if (keyA < keyB) {
		return -1;
	}
	return keyA > keyB ? 1 : 0;
};

const fixedOrder = (keys: readonly string[], fallback: CompareFn): CompareFn => {
	const indexes = new Map(keys.map((key, index) => [key, index]));

	return (keyA, keyB) => {
		const indexA = indexes.get(keyA);
		const indexB = indexes.get(keyB);

		if (indexA == null && indexB == null) {
			return fallback(keyA, keyB);
		}
		if (indexA == null) {
			return 1;
		}
		if (indexB == null) {
			return -1;
		}

		return indexA - indexB;
	};
};

/**
 * Default package.json sort options
 *
 * Credit to keithamus's `sort-package-json` for the ordering
 * https://github.com/keithamus/sort-package-json
 */
export const DEFAULT_PACKAGE_JSON_SORT_OPTIONS: SortOptions = {
	order: "fixed",
	keys: [
		"$schema",
		"name",
		"displayName",
		"version",
		"stableVersion",
		"private",
		"description",
		"categories",
		"keywords",
		"homepage",
		"bugs",
		"repository",
		"funding",
		"license",
		"qna",
		"author",
		"maintainers",
		"contributors",
		"publisher",
		"sideEffects",
		"type",
		"imports",
		"exports",
		"main",
		"svelte",
		"umd:main",
		"jsdelivr",
		"unpkg",
		"module",
		"source",
		"jsnext:main",
		"browser",
		"react-native",
		"types",
		"typesVersions",
		"typings",
		"style",
		"example",
		"examplestyle",
		"assets",
		"bin",
		"man",
		"directories",
		"files",
		"workspaces",
		"binary",
		"scripts",
		"betterScripts",
		"wireit",
		"l10n",
		"contributes",
		"activationEvents",
		"husky",
		"simple-git-hooks",
		"pre-commit",
		"commitlint",
		"lint-staged",
		"nano-staged",
		"config",
		"nodemonConfig",
		"browserify",
		"babel",
		"browserslist",
		"xo",
		"prettier",
		"eslintConfig",
		"eslintIgnore",
		"npmpkgjsonlint",
		"npmPackageJsonLintConfig",
		"npmpackagejsonlint",
		"release",
		"remarkConfig",
		"stylelint",
		"ava",
		"jest",
		"jest-junit",
		"jest-stare",
		"mocha",
		"nyc",
		"c8",
		"tap",
		"oclif",
		"resolutions",
		"overrides",
		"dependencies",
		"devDependencies",
		"dependenciesMeta",
		"peerDependencies",
		"peerDependenciesMeta",
		"optionalDependencies",
		"bundledDependencies",
		"bundleDependencies",
		"extensionPack",
		"extensionDependencies",
		"flat",
		"packageManager",
		"engines",
		"engineStrict",
		"devEngines",
		"volta",
		"languageName",
		"os",
		"cpu",
		"preferGlobal",
		"publishConfig",
		"icon",
		"badges",
		"galleryBanner",
		"preview",
		"markdown",
		"pnpm",
	],
	fallbackCompare: alphabetize,
	overrides: {
		categories: { order: "alphabetical" },
		keywords: { order: "alphabetical" },
		bugs: { order: "fixed", keys: ["url", "email"] },
		repository: { order: "fixed", keys: ["type", "url"] },
		funding: { order: "fixed", keys: ["type", "url"] },
		license: { order: "fixed", keys: ["type", "url"] },
		author: { order: "fixed", keys: ["name", "email", "url"] },
		maintainers: { order: "fixed", keys: ["name", "email", "url"] },
		contributors: { order: "fixed", keys: ["name", "email", "url"] },
		imports: { order: "alphabetical", children: { order: "alphabetical" } },
		exports: { order: "alphabetical" },
		bin: { order: "alphabetical" },
		directories: {
			order: "fixed",
			keys: ["lib", "bin", "man", "doc", "example", "test"],
		},
		files: { order: "alphabetical" },
		workspaces: {
			order: "fixed",
			keys: ["packages", "catalog"],
			overrides: {
				packages: { order: "alphabetical" },
				catalog: { order: "alphabetical" },
			},
		},
		binary: {
			order: "fixed",
			keys: ["module_name", "module_path", "remote_path", "package_name", "host"],
		},
		scripts: { order: "alphabetical" },
		betterScripts: { order: "alphabetical" },
		wireit: { order: "alphabetical", children: { order: "alphabetical" } },
		contributes: { order: "alphabetical" },
		activationEvents: { order: "alphabetical" },
		husky: { order: "alphabetical", overrides: { hooks: { order: "alphabetical" } } },
		"simple-git-hooks": { order: "alphabetical" },
		commitlint: { order: "alphabetical" },
		config: { order: "alphabetical" },
		nodemonConfig: { order: "alphabetical" },
		browserify: { order: "alphabetical" },
		babel: { order: "alphabetical" },
		xo: { order: "alphabetical" },
		prettier: { order: "alphabetical" },
		eslintConfig: { order: "alphabetical", children: { order: "alphabetical" } },
		eslintIgnore: { order: "alphabetical" },
		npmpkgjsonlint: { order: "alphabetical" },
		npmPackageJsonLintConfig: { order: "alphabetical" },
		npmpackagejsonlint: { order: "alphabetical" },
		release: { order: "alphabetical" },
		remarkConfig: { order: "alphabetical" },
		ava: { order: "alphabetical" },
		jest: { order: "alphabetical" },
		"jest-junit": { order: "alphabetical" },
		"jest-stare": { order: "alphabetical" },
		mocha: { order: "alphabetical" },
		nyc: { order: "alphabetical" },
		c8: { order: "alphabetical" },
		tap: { order: "alphabetical" },
		oclif: { order: "alphabetical", children: { order: "alphabetical" } },
		resolutions: { order: "alphabetical" },
		overrides: { order: "alphabetical" },
		dependencies: { order: "alphabetical" },
		devDependencies: { order: "alphabetical" },
		dependenciesMeta: { order: "alphabetical", children: { order: "alphabetical" } },
		peerDependencies: { order: "alphabetical" },
		peerDependenciesMeta: { order: "alphabetical", children: { order: "alphabetical" } },
		optionalDependencies: { order: "alphabetical" },
		bundledDependencies: { order: "alphabetical" },
		bundleDependencies: { order: "alphabetical" },
		extensionPack: { order: "alphabetical" },
		extensionDependencies: { order: "alphabetical" },
		engines: { order: "alphabetical" },
		devEngines: {
			order: "alphabetical",
			overrides: {
				runtime: { order: "fixed", keys: ["name", "version", "onFail"] },
				packageManager: { order: "fixed", keys: ["name", "version", "onFail"] },
			},
		},
		volta: { order: "fixed", keys: ["node", "npm", "yarn"] },
		os: { order: "alphabetical" },
		cpu: { order: "alphabetical" },
		preferGlobal: { order: "alphabetical" },
		publishConfig: { order: "alphabetical" },
		badges: { order: "fixed", keys: ["description", "url", "href"] },
		galleryBanner: { order: "alphabetical" },
		pnpm: { order: "alphabetical", children: { order: "alphabetical" } },
	},
};

export const getCompareFunction = (options: SortOptions): CompareFn | undefined => {
	switch (options.order) {
		case "alphabetical": {
			return alphabetize;
		}
		case "custom": {
			return options.compare;
		}
		case "fixed": {
			return fixedOrder(options.keys, options.fallbackCompare ?? alphabetize);
		}
		case "none": {
			return undefined;
		}
	}
};
export const sortJsonValue = (value: unknown, compare: CompareFn) => {
	if (v.is(StringArraySchema, value)) {
		return value.toSorted(compare);
	}

	return v.is(JsonObjectSchema, value) ? sortKeys(value, compare) : undefined;
};
