import { defineConfig } from "tsup";

// Two entries: the main barrel and a `/handlers` sub-path for the Next.js
// route-handler factories so consumers can write
//   export { GET, POST } from "@ikirugai/adapt-server/handlers";
export default defineConfig({
  entry: {
    index: "src/index.ts",
    handlers: "src/handlers/index.ts"
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  external: [
    "react",
    "next",
    "next/headers",
    "next/navigation",
    "next/server",
    "pg"
  ]
});
