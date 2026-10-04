import { defineConfig } from "monoswan";

export default defineConfig({
  variants: {
    "my-library": {
      packageJson: {
        type: "module",
        scripts: { build: "tsdown" },
      },
      initialization: {
        packageJson: {
          version: "0.0.0",
          private: true,
        },
        tsConfig: {
          extends: "@myrepo/typescript-config/library.json",
        },
        additionalTextFiles: {
          "src/index.ts": "export {};\n",
        },
      },
    },
  },
});
