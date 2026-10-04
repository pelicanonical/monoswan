import { defineConfig, enforceVariants } from "monoswan";

export default defineConfig({
	rules: [enforceVariants()],
});
