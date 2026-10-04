import type { TsdownPlugin, UserConfig } from "tsdown";

const isDevMode = process.env.NODE_ENV === "development";

export const LibPlugin = (config: Pick<UserConfig, "platform">): TsdownPlugin => {
  return {
    name: "pelicanstack-tsdown-lib-plugin",
    tsdownConfig: () => {
      return {
        ...config,
        format: ["esm"],
        outExtensions: () => ({ js: ".mjs", dts: ".d.ts" }),
        sourcemap: isDevMode,
        dts: {
          sourcemap: isDevMode,
        },
      };
    },
  };
};
