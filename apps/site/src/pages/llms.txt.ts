const documentationFiles = import.meta.glob("../content/docs/**/*.mdx", {
	eager: true,
	import: "default",
	query: "?raw",
}) as Record<string, string>;

const snippetFiles = import.meta.glob("../content/docs/code-snippets/*", {
	eager: true,
	import: "default",
	query: "?raw",
}) as Record<string, string>;

const pageOrder = [
	"index.mdx",
	"quick-start.mdx",
	"configuration/index.mdx",
	"configuration/root-reference.mdx",
	"configuration/variants.mdx",
	"configuration/variant-files.mdx",
	"configuration/package-templates.mdx",
	"linting/index.mdx",
	"linting/built-in.mdx",
	"linting/custom.mdx",
	"commands/index.mdx",
	"commands/create-package.mdx",
	"commands/init.mdx",
	"commands/lint.mdx",
	"commands/print-config.mdx",
] as const;

const additionalPagePaths = Object.keys(documentationFiles)
	.map((path) => path.split("/content/docs/")[1])
	.filter(
		(path): path is string =>
			path != null && !pageOrder.includes(path as (typeof pageOrder)[number]),
	)
	.toSorted();

const orderedPagePaths: readonly string[] = [...pageOrder, ...additionalPagePaths];

interface ParsedPage {
	title: string;
	description: string;
	slug: string;
	body: string;
}

const getFrontmatterValue = (frontmatter: string, key: string): string =>
	frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.trim() ?? "";

const resolveSnippet = (specifier: string): string => {
	const fileName = specifier
		.replace(/\?raw$/, "")
		.split("/")
		.at(-1);
	const entry = Object.entries(snippetFiles).find(([path]) => path.endsWith(`/${fileName}`));

	if (entry == null) {
		throw new Error(`Could not resolve documentation snippet ${specifier}`);
	}

	return entry[1].trimEnd();
};

const convertMdx = (source: string): ParsedPage => {
	const frontmatterMatch = source.match(/^---\n([\s\S]*?)\n---\n/);
	if (frontmatterMatch == null) {
		throw new Error("Documentation page is missing frontmatter");
	}

	const frontmatter = frontmatterMatch[1];
	const values = new Map<string, string>();
	let body = source.slice(frontmatterMatch[0].length);

	body = body.replaceAll(
		/^import\s+(\w+)\s+from\s+["']([^"']+\?raw)["'];\s*$/gm,
		(_statement, name: string, specifier: string) => {
			values.set(name, resolveSnippet(specifier));
			return "";
		},
	);

	body = body.replaceAll(
		/^export const (\w+) = `([\s\S]*?)`;\s*$/gm,
		(_statement, name: string, value: string) => {
			values.set(name, value);
			return "";
		},
	);

	body = body
		.replaceAll(/^import .*@astrojs\/starlight\/components["'];\s*$/gm, "")
		.replaceAll(/^import AgentPrompt .*;\s*$/gm, "")
		.replaceAll(/<Code\s+([\s\S]*?)\s*\/>/g, (_component, attributes: string) => {
			const codeMatch = attributes.match(/code=\{(?:`([\s\S]*?)`|(\w+))\}/);
			const language = attributes.match(/lang=["']([^"']+)["']/)?.[1] ?? "text";
			const title = attributes.match(/title=["']([^"']+)["']/)?.[1];
			const code = codeMatch?.[1] ?? values.get(codeMatch?.[2] ?? "");

			if (code == null) {
				throw new Error(`Could not resolve Code component: ${attributes}`);
			}

			return `${title == null ? "" : `**${title}**\n\n`}\`\`\`${language}\n${code.trimEnd()}\n\`\`\``;
		})
		.replaceAll(/<AgentPrompt\s+prompt=\{(\w+)\}\s*\/>/g, (_component, name: string) => {
			const prompt = values.get(name);
			return prompt == null ? "" : `**AI setup prompt**\n\n\`\`\`text\n${prompt}\n\`\`\``;
		})
		.replaceAll(/<ul[^>]*>/g, "")
		.replaceAll("</ul>", "")
		.replaceAll(/\s*<li>\s*/g, "\n- ")
		.replaceAll(/\s*<\/li>/g, "\n")
		.replaceAll(/^(#{2,6}) /gm, "#$1 ")
		.replaceAll("](/docs/", "](https://monoswan.com/docs/")
		.replaceAll(/\n{3,}/g, "\n\n")
		.trim();

	return {
		title: getFrontmatterValue(frontmatter, "title"),
		description: getFrontmatterValue(frontmatter, "description"),
		slug: getFrontmatterValue(frontmatter, "slug"),
		body,
	};
};

const pages = orderedPagePaths.map((relativePath) => {
	const entry = Object.entries(documentationFiles).find(([path]) =>
		path.endsWith(`/docs/${relativePath}`),
	);

	if (entry == null) {
		throw new Error(`Could not find documentation page ${relativePath}`);
	}

	return convertMdx(entry[1]);
});

const contents = [
	"# monoswan documentation",
	"",
	"Complete monoswan documentation in a plain-text format intended for language models.",
	"",
	"## Documentation index",
	"",
	...pages.map(
		(page) => `- [${page.title}](https://monoswan.com/${page.slug}/): ${page.description}`,
	),
	...pages.flatMap((page) => [
		"",
		"---",
		"",
		`## ${page.title}`,
		"",
		`Source: https://monoswan.com/${page.slug}/`,
		"",
		page.body,
	]),
	"",
].join("\n");

export const prerender = true;

export const GET = () =>
	new Response(contents, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
		},
	});
