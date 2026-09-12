import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const host = process.env.SOREN_HOST || '127.0.0.1';
const port = Number(process.env.SOREN_PORT || 8787);
const allowedOrigin = process.env.SOREN_SITE_ORIGIN || '*';
const adapters = {
  codex: process.env.CODEX_APP_SERVER_URL || '',
  ombre: process.env.OMBRE_MCP_URL || '',
  cyberboss: process.env.CYBERBOSS_URL || '',
  games: process.env.GAME_MCP_URL || '',
  music: process.env.MUSIC_MCP_URL || ''
};

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
  const entries = await Promise.all(Object.entries(adapters).map(async ([name, url]) => [name, await probe(url)]));
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
async function forwardChat(message) {
  if (!adapters.codex) return null;
  const response = await fetch(`${adapters.codex.replace(/\/$/, '')}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`Codex adapter returned ${response.status}`);
  const data = await response.json();
  return data.reply || data.output_text || data.message;
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
    if (req.method === 'POST' && url.pathname === '/api/chat/send') {
      const input = await readBody(req);
      if (!input.message?.trim()) return json(res, 400, { message: '消息不能为空' });
      const reply = await forwardChat(input.message.trim());
      if (!reply) return json(res, 503, { code: 'codex_not_configured', message: 'Soren Core 已连接，但 Codex Runtime 还没有配置。' });
      return json(res, 200, { reply });
    }
    if (url.pathname.startsWith('/api/')) return json(res, 404, { message: 'Unknown API route' });
    return serveStatic(req, res);
  } catch (error) {
    return json(res, 500, { message: error.message || 'Soren Core error' });
  }
});

server.listen(port, host, () => console.log(`Soren Core running at http://${host}:${port}`));
