import { createRule, defineConfig } from "monoswan";

interface RequireFieldOptions {
	field: "description" | "license";
}

const requireField = createRule<RequireFieldOptions>(({ field }) => ({
	name: `require-${field}`,
	check: (context) =>
		context.packageJson[field] == null
			? [
					{
						message: `Expected ${field}`,
						packageContext: context,
						filePath: `${context.packagePath}/package.json`,
						locator: { type: "json", locator: [field] },
					},
				]
			: [],
}));

export default defineConfig({
	rules: [requireField({ field: "license" }, { ignore: { paths: ["examples/**"] } })],
});
