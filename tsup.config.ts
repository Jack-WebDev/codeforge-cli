import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["esm"],
  target: "node16",
  splitting: false,
  clean: true,
  dts: false,
  minify: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
