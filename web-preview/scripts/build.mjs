import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(packageRoot, "dist");
const sources = ["index.html", "styles.css", "app.js", "model.mjs"];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const source of sources) {
  const contents = await readFile(join(packageRoot, source), "utf8");
  if (!contents.trim()) throw new Error(`${source} is empty`);
  await cp(join(packageRoot, source), join(output, source));
}

const appSource = await readFile(join(packageRoot, "app.js"), "utf8");
for (const forbidden of ["fetch(", "XMLHttpRequest", "WebSocket", "EventSource"] ) {
  if (appSource.includes(forbidden)) throw new Error(`Network API is not allowed in preview source: ${forbidden}`);
}

const metadata = {
  name: "EqualPath Iteration 1 Web Preview",
  version: "0.1.0",
  sourceCommit: process.env.GITHUB_SHA ?? "local",
  dataMode: "deterministic-local-preview"
};
await writeFile(join(output, "build-meta.json"), `${JSON.stringify(metadata, null, 2)}\n`);
await writeFile(join(output, ".nojekyll"), "");

console.log(`Built ${sources.length + 2} files in ${output}`);
