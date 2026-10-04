import { writeFile } from "node:fs/promises";
import { createRule, defineConfig } from "monoswan";

const requireDescription = createRule(() => ({
	name: "require-description",
	check: (context) =>
		context.packageJson.description == null
			? [
					{
						message: "Expected a description",
						packageContext: context,
						filePath: `${context.packagePath}/package.json`,
						locator: { type: "json", locator: ["description"] },
						autofix: async ({ packageJson, packagePath }) => {
							const updated = { ...packageJson, description: "TODO" };
							await writeFile(
								`${packagePath}/package.json`,
								`${JSON.stringify(updated, null, "\t")}\n`,
							);
						},
					},
				]
			: [],
}));

export default defineConfig({
	rules: [requireDescription()],
});
