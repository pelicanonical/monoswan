import { LibPlugin } from "@monoswan/tsdown-lib-plugin";
import { defineConfig } from "tsdown";

export default defineConfig({
  plugins: [LibPlugin({ platform: "node" })],
  entry: ["./src/config.ts", "./src/cli.ts"],
});
