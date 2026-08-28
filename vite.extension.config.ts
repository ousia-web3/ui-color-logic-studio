import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const repositoryRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: path.join(repositoryRoot, "extension"),
  base: "./",
  publicDir: path.join(repositoryRoot, "extension", "public"),
  plugins: [react()],
  resolve: {
    alias: {
      "@": repositoryRoot,
    },
  },
  css: {
    postcss: repositoryRoot,
  },
  build: {
    outDir: path.join(repositoryRoot, "extension", "dist"),
    emptyOutDir: true,
    target: "chrome114",
  },
});
