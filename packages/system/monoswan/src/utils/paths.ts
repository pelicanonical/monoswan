import path from "node:path";
import { RELATIVE_PACKAGE_CONFIG_PATH } from "../types/package-config.ts";

export const getTsconfigPath = (packageDir: string) => path.join(packageDir, "tsconfig.json");
export const getPackageJsonPath = (packageDir: string) => path.join(packageDir, "package.json");
export const getMonoswanStandalonePackageConfigPath = (packageDir: string) =>
  path.join(packageDir, RELATIVE_PACKAGE_CONFIG_PATH);

export const resolveAbsolutePath = (relativePath: string) =>
  path.resolve(process.cwd(), relativePath);
