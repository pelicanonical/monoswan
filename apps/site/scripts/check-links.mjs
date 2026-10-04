import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const outputDirectory = path.resolve(import.meta.dirname, "../dist");

const listHtmlFiles = async (directory) => {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map((entry) => {
			const entryPath = path.join(directory, entry.name);
			return entry.isDirectory()
				? listHtmlFiles(entryPath)
				: Promise.resolve(entry.name.endsWith(".html") ? [entryPath] : []);
		}),
	);
	return files.flat();
};

const htmlFiles = await listHtmlFiles(outputDirectory);
const outputEntries = await readdir(outputDirectory, { recursive: true });
const outputFiles = new Set(outputEntries.map((file) => file.split(path.sep).join("/")));
const failures = [];

const resolveTarget = (href) => {
	const pathname = new URL(href, "https://monoswan.com").pathname;
	const relativePath = decodeURIComponent(pathname).replace(/^\//, "");
	if (relativePath === "") return "index.html";
	if (path.extname(relativePath) !== "") return relativePath;
	return `${relativePath.replace(/\/$/, "")}/index.html`;
};

for (const file of htmlFiles) {
	const html = await readFile(file, "utf8");
	for (const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
		const href = match[1];
		if (
			href == null ||
			href.startsWith("#") ||
			href.startsWith("data:") ||
			href.startsWith("mailto:") ||
			href.startsWith("tel:") ||
			/^https?:\/\//.test(href)
		) {
			continue;
		}

		const target = resolveTarget(href);
		if (!outputFiles.has(target)) {
			failures.push(`${path.relative(outputDirectory, file)} -> ${href}`);
		}
	}
}

if (failures.length > 0) {
	console.error(`Broken local links:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
	process.exitCode = 1;
} else {
	console.log(`Checked ${htmlFiles.length} HTML files; all local links resolve.`);
}
