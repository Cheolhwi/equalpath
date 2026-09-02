import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("HTML labels the safe preview and blocks network connections", async () => {
  const html = await readFile(join(root, "index.html"), "utf8");
  assert.match(html, /Safe preview/i);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /No Google sign-in/);
  assert.match(html, /No Appwrite writes/);
});

test("browser code does not contain network clients", async () => {
  const source = await readFile(join(root, "app.js"), "utf8");
  for (const forbidden of ["fetch(", "XMLHttpRequest", "WebSocket", "EventSource"]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test("the responsive stylesheet provides focus, touch and reduced-motion rules", async () => {
  const css = await readFile(join(root, "styles.css"), "utf8");
  assert.match(css, /focus-visible/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /max-width:\s*500px/);
});
