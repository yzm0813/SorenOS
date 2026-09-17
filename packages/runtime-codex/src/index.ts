import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const packageRoot = fileURLToPath(new URL('../../../', import.meta.url));
const integrationRoot = resolve(packageRoot, '..', 'integrations', 'cyberboss');
const { CodexRpcClient } = require(resolve(integrationRoot, 'src/adapters/runtime/codex/rpc-client.js')) as { CodexRpcClient: new (options: any) => any };

type RuntimeEvent =
  | { type: 'delta'; text: string }
  | { type: 'tool-started' | 'tool-completed'; tool: string }
  | { type: 'file-changed'; paths: string[] };

function id(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
function threadIdOf(params: any) { return id(params?.threadId); }
function turnIdOf(params: any) { return id(params?.turnId || params?.turn?.id); }
function itemText(item: any) {
  if (typeof item?.text === 'string') return item.text;
  const content = Array.isArray(item?.content) ? item.content : [];
  return content.map((entry: any) => typeof entry?.text === 'string' ? entry.text : '').join('');
}

export class CodexRuntime {
  private client: any;
  private ready = false;
  private freshThreads = new Set<string>();
  constructor(private endpoint = 'ws://127.0.0.1:8765') { this.client = new CodexRpcClient({ endpoint }); }

  async initialize() {
    if (this.ready && this.client.isTransportReady()) return;
    await this.client.connect();
    await this.client.initialize();
    this.ready = true;
  }

  async models() {
    await this.initialize();
    const response = await this.client.listModels();
    return response?.result?.data || [];
  }

  async createThread(cwd: string, model = '') {
    await this.initialize();
    const response = await this.client.startThread({ cwd, model });
    const threadId = id(response?.result?.thread?.id);
    if (!threadId) throw new Error('Codex 没有返回会话 ID');
    this.freshThreads.add(threadId);
    return threadId;
  }

  async run(options: {
    threadId: string;
    text: string;
    model?: string;
    effort?: string;
    cwd: string;
    attachments?: Array<{ absolutePath: string }>;
    onTurnStarted?: (turnId: string) => void;
    onEvent: (event: RuntimeEvent) => void;
  }) {
    await this.initialize();
    if (this.freshThreads.has(options.threadId)) this.freshThreads.delete(options.threadId);
    else await this.client.resumeThread({ threadId: options.threadId });
    let expectedTurnId = '';
    let activeTurnId = '';
    let streamed = '';
    const completed = new Promise<{ turnId: string; text: string }>((resolveDone, reject) => {
      const timer = setTimeout(() => { cleanup(); reject(new Error('Codex 回复超时')); }, 10 * 60_000);
      const unsubscribe = this.client.onMessage((message: any) => {
        const params = message?.params || {};
        if (threadIdOf(params) !== options.threadId) return;
        const eventTurnId = turnIdOf(params);
        if ((message.method === 'turn/started' || message.method === 'turn/start') && eventTurnId) activeTurnId ||= eventTurnId;
        const tracked = expectedTurnId || activeTurnId;
        if (tracked && eventTurnId && eventTurnId !== tracked) return;
        if (message.method === 'item/agentMessage/delta') {
          const delta = typeof params.delta === 'string' ? params.delta : '';
          if (delta) { streamed += delta; options.onEvent({ type: 'delta', text: delta }); }
        }
        if (message.method === 'item/started') {
          const type = String(params?.item?.type || 'tool');
          if (type !== 'agentMessage' && type !== 'reasoning') options.onEvent({ type: 'tool-started', tool: type });
        }
        if (message.method === 'item/completed') {
          const type = String(params?.item?.type || 'tool');
          if (type === 'agentMessage' && !streamed) {
            const text = itemText(params.item);
            if (text) { streamed = text; options.onEvent({ type: 'delta', text }); }
          } else if (type !== 'agentMessage' && type !== 'reasoning') {
            options.onEvent({ type: 'tool-completed', tool: type });
          }
          if (/file/i.test(type)) {
            const paths = [params?.item?.path, ...(params?.item?.changes || []).map((change: any) => change.path)].filter(Boolean);
            if (paths.length) options.onEvent({ type: 'file-changed', paths });
          }
        }
        if (message.method === 'turn/failed') {
          cleanup();
          reject(new Error(params?.turn?.error?.message || params?.error?.message || 'Codex 执行失败'));
        }
        if (message.method === 'turn/completed') {
          cleanup();
          resolveDone({ turnId: eventTurnId || tracked, text: streamed || '已完成。' });
        }
      });
      const cleanup = () => { clearTimeout(timer); unsubscribe(); };
    });
    const response = await this.client.sendUserMessage({
      threadId: options.threadId,
      text: options.text,
      attachments: options.attachments || [],
      model: options.model || '',
      effort: options.effort || '',
      workspaceRoot: options.cwd
    });
    expectedTurnId = id(response?.result?.turn?.id || response?.result?.turnId || response?.result?.id);
    if (expectedTurnId) options.onTurnStarted?.(expectedTurnId);
    return completed;
  }

  async cancel(threadId: string, turnId: string) {
    await this.initialize();
    return this.client.cancelTurn({ threadId, turnId });
  }

  async dispose() {
    await this.client.close();
    this.ready = false;
    this.freshThreads.clear();
  }
}
