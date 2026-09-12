import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const require = createRequire(import.meta.url);
const { CyberbossAdapter } = require('./cyberboss-adapter.cjs');
const { CodexAdapter } = require('./codex-adapter.cjs');
const cyberbossStateDir = fileURLToPath(new URL('../../data/cyberboss/', import.meta.url));
const cyberboss = new CyberbossAdapter({ stateDir: cyberbossStateDir });
const siteRoot = fileURLToPath(new URL('../', import.meta.url));
const codex = new CodexAdapter({
  endpoint: process.env.CODEX_APP_SERVER_ENDPOINT || 'ws://127.0.0.1:8765',
  workspaceRoot: siteRoot,
  stateFile: join(cyberbossStateDir, 'soren-codex-thread.json')
});
const host = process.env.SOREN_HOST || '127.0.0.1';
const port = Number(process.env.SOREN_PORT || 8787);
const allowedOrigin = process.env.SOREN_SITE_ORIGIN || '*';
const adapters = {
  codex: process.env.CODEX_APP_SERVER_URL || 'http://127.0.0.1:8765/readyz',
  ombre: process.env.OMBRE_MCP_URL || 'http://127.0.0.1:18001/health',
  cyberboss: process.env.CYBERBOSS_URL || 'http://127.0.0.1:8765/readyz',
  games: process.env.GAME_MCP_URL || '',
  music: process.env.MUSIC_MCP_URL || ''
};
const ombreMcpUrl = process.env.OMBRE_MCP_ENDPOINT || 'http://127.0.0.1:18001/mcp';

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
const cors = () => ({ 'Access-Control-Allow-Origin': allowedOrigin, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' });
const json = (res, status, payload) => { res.writeHead(status, { ...cors(), 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(payload)); };

async function probe(url) {
  if (!url) return { configured: false, connected: false };
  try {
    const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(1500) });
    return { configured: true, connected: response.ok };
  } catch {
    return { configured: true, connected: false };
  }
}
async function serviceState() {
  const entries = await Promise.all(Object.entries(adapters).map(async ([name, url]) => [
    name,
    name === 'cyberboss' ? cyberboss.status() : await probe(url)
  ]));
  return Object.fromEntries(entries);
}
async function readBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) throw new Error('请求内容过大');
  }
  return raw ? JSON.parse(raw) : {};
}
async function callOmbre(name, args = {}) {
  const response = await fetch(ombreMcpUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } }),
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`Ombre Brain returned ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'Ombre Brain error');
  const content = data.result?.content || [];
  return content.filter(item => item.type === 'text').map(item => item.text).join('\n');
}
async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requestPath = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const target = normalize(join(root, requestPath));
  if (!target.startsWith(normalize(root))) return json(res, 403, { message: 'Forbidden' });
  try {
    const info = await stat(target);
    const file = info.isDirectory() ? join(target, 'index.html') : target;
    const content = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
    res.end(content);
  } catch {
    json(res, 404, { message: 'Not found' });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors());
    return res.end();
  }
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { ok: true, name: 'soren-core', version: 1 });
    if (req.method === 'GET' && url.pathname === '/api/bootstrap') return json(res, 200, { core: { connected: true, version: 1 }, services: await serviceState() });
    if (req.method === 'GET' && url.pathname === '/api/models') return json(res, 200, { models: await codex.models() });
    if (req.method === 'POST' && url.pathname === '/api/chat/send') {
      const input = await readBody(req);
      if (!input.message?.trim()) return json(res, 400, { message: '消息不能为空' });
      const memory = await callOmbre('breath').catch(() => '');
      const result = await codex.chat(input.message.trim(), {
        memory,
        model: typeof input.model === 'string' ? input.model : '',
        effort: typeof input.effort === 'string' ? input.effort : ''
      });
      return json(res, 200, result);
    }
    if (req.method === 'POST' && url.pathname === '/api/memory/breath') {
      return json(res, 200, { content: await callOmbre('breath') });
    }
    if (req.method === 'POST' && url.pathname === '/api/memory/search') {
      const input = await readBody(req);
      if (!input.query?.trim()) return json(res, 400, { message: '搜索内容不能为空' });
      return json(res, 200, { content: await callOmbre('breath_search', { query: input.query.trim(), max_results: 10 }) });
    }
    if (req.method === 'POST' && url.pathname === '/api/memory/hold') {
      const input = await readBody(req);
      if (!input.content?.trim()) return json(res, 400, { message: '记忆内容不能为空' });
      return json(res, 200, { content: await callOmbre('hold', { content: input.content.trim(), title: input.title || '', domain: input.domain || '', importance: Number(input.importance || 5) }) });
    }
    if (req.method === 'GET' && url.pathname === '/api/reminders') return json(res, 200, { reminders: cyberboss.listReminders() });
    if (req.method === 'POST' && url.pathname === '/api/reminders') {
      const input = await readBody(req);
      return json(res, 201, { reminder: cyberboss.createReminder(input) });
    }
    if (req.method === 'GET' && url.pathname === '/api/inbox') return json(res, 200, { messages: cyberboss.listInbox() });
    if (req.method === 'GET' && url.pathname === '/api/timeline') return json(res, 200, { events: cyberboss.listTimeline() });
    if (req.method === 'POST' && url.pathname === '/api/timeline') {
      const input = await readBody(req);
      return json(res, 201, { event: cyberboss.addTimeline(input) });
    }
    if (req.method === 'GET' && url.pathname === '/api/device/snapshot') return json(res, 200, { snapshot: cyberboss.deviceSnapshot() });
    if (req.method === 'POST' && url.pathname === '/api/device/ingest') {
      const input = await readBody(req);
      return json(res, 202, { accepted: true, point: cyberboss.ingestDevice(input) });
    }
    if (url.pathname.startsWith('/api/')) return json(res, 404, { message: 'Unknown API route' });
    return serveStatic(req, res);
  } catch (error) {
    return json(res, 500, { message: error.message || 'Soren Core error' });
  }
});

setInterval(() => cyberboss.pollDue(), 5000).unref();
server.listen(port, host, () => console.log(`Soren Core running at http://${host}:${port}`));
