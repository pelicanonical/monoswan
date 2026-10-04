import { defineConfig, requireMonoswanConfig } from "monoswan";

export default defineConfig({
  rules: [requireMonoswanConfig({ requireVariant: true })],
});
