import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('./', import.meta.url);
const html = readFileSync(new URL('./dist/index.html', root), 'utf8');
const entry = html.match(/<script[^>]+src="([^"]+)"/i)?.[1];
if (!entry) throw new Error('Built index.html has no JavaScript entry.');

const entryPath = resolve(fileURLToPath(new URL('./dist/', root)), entry.replace(/^\//, ''));
if (!existsSync(entryPath) || statSync(entryPath).size === 0) throw new Error(`Built JavaScript entry is missing: ${entry}`);

const app = readFileSync(new URL('./apps/web/src/App.tsx', root), 'utf8');
for (const feature of ['HomeView', 'ChatView', 'WorkspaceView', 'MemoryView', 'TimelineView', 'SettingsView']) {
  if (!app.includes(`<${feature}`)) throw new Error(`App shell does not mount ${feature}.`);
}

const server = readFileSync(new URL('./apps/core/src/server.ts', root), 'utf8');
for (const route of ['/api/bootstrap', '/api/home', '/api/weather/locations', '/api/conversations', '/api/projects', '/api/memory/breath', '/api/memories', '/api/memory/seed/preview', '/api/mcp']) {
  if (!server.includes(route)) throw new Error(`Core route is missing: ${route}`);
}

console.log('Soren build contract validation passed.');
