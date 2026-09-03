import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The published site is a GitHub Pages project site at /equalpath/, so every
// generated asset URL has to carry that prefix. `npm run dev` serves from "/".
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/equalpath/" : "/",
  plugins: [react()],
  build: {
    outDir: "dist",
    // The Pages workflow uploads web-preview/dist. Emptying the directory is
    // not possible on every machine, so Vite overwrites in place instead; CI
    // always builds into a fresh checkout because dist is git-ignored.
    emptyOutDir: false,
    target: "es2022",
    sourcemap: false
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"]
  }
}));
