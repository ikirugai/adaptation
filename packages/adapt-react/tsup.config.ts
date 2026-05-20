import { defineConfig } from "tsup";

// Unbundled output: one .js + .d.ts per source file. We need this so the
// per-file "use client" directives survive — bundling concatenates files and
// esbuild strips the directives during merge (it warns: "Module level
// directives cause errors when bundled, 'use client' was ignored"). With
// bundle: false each file maps 1:1 to its source and the directive is kept.
export default defineConfig({
  entry: ["src/**/*.ts", "src/**/*.tsx"],
  format: ["esm"],
  dts: true,
  clean: true,
  splitting: false,
  bundle: false,
  sourcemap: true,
  outDir: "dist",
  external: [
    "react",
    "react-dom",
    "next",
    "next/navigation",
    "next/headers",
    "next/link",
    "next/image",
    "next/server"
  ],
  // Use React's automatic JSX runtime (the source files don't `import React`
  // and rely on the compiler injecting `react/jsx-runtime` imports). esbuild
  // / tsup defaults to the classic runtime which emits `React.createElement`
  // calls, which then ReferenceError because `React` isn't in scope.
  esbuildOptions(options) {
    options.jsx = "automatic";
  }
});
