import { readFileSync } from "node:fs";

const html = readFileSync(new URL("./dist/index.html", import.meta.url), "utf8");
const client = readFileSync(new URL("./dist/soren-client.js", import.meta.url), "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
if (scripts.length !== 1) throw new Error(`Expected one inline script, found ${scripts.length}`);
new Function(scripts[0]);
new Function(client);
for (const id of ["chatView", "workspaceView", "momentsView", "togetherView", "memoryView", "timelineView"]) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Missing view: ${id}`);
}
console.log("Soren connected-shell validation passed.");
