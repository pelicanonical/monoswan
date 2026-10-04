import { defineConfig } from "tsdown";
import { LibPlugin } from "./src/lib-plugin.ts";

export default defineConfig({
	plugins: [LibPlugin({ platform: "node" })],
	deps: {
		neverBundle: ["tsdown"],
	},
});
