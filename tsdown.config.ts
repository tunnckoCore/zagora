import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "new-src/*.ts",
  outExtensions: () => ({
    js: ".js",
    dts: ".d.ts",
  }),
  target: "es2024",
  minify: true,
  clean: true,
  dts: true,
});
