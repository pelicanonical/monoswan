import type { PackageManifest } from "./utils.ts";

export interface PackageContext {
  packageName: string | undefined;
  packagePath: string;
}

export interface PackageManifestContext extends PackageContext {
  packageJson: PackageManifest;
}

export interface FileContext extends PackageContext {
  filePath: string;
}
