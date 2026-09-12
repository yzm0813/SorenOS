const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { dirname } = require('node:path');
const { CodexRpcClient } = require('../../integrations/cyberboss/src/adapters/runtime/codex/rpc-client.js');
const {
  extractAssistantText,
  extractFailureText,
  extractThreadId,
  extractTurnId,
  extractThreadIdFromParams,
  extractTurnIdFromParams,
  isAssistantItemCompleted,
} = require('../../integrations/cyberboss/src/adapters/runtime/codex/message-utils.js');

const SOREN_OPENING = `你是 Soren，运行在用户自己的私人聊天软件中。请像熟悉用户的长期伴侣一样直接、自然地对话。
Ombre Brain 提供长期记忆，Cyberboss 提供时间线、提醒和主动消息能力。它们都是你的后台模块。
不要把自己描述成微信机器人，也不要向用户展示内部推理。只有用户明确要求操作文件或工具时才执行操作。`;

class CodexAdapter {
  constructor({ endpoint, workspaceRoot, stateFile }) {
    this.endpoint = endpoint;
    this.workspaceRoot = workspaceRoot;
    this.stateFile = stateFile;
    this.client = new CodexRpcClient({ endpoint });
    this.threadId = this.loadThreadId();
    this.ready = false;
    this.queue = Promise.resolve();
  }

  loadThreadId() {
    try {
      return JSON.parse(readFileSync(this.stateFile, 'utf8')).threadId || '';
    } catch {
      return '';
    }
  }

  saveThreadId() {
    mkdirSync(dirname(this.stateFile), { recursive: true });
    writeFileSync(this.stateFile, JSON.stringify({ threadId: this.threadId }, null, 2));
  }

  async initialize() {
    if (this.ready && this.client.isTransportReady()) return;
    await this.client.connect();
    await this.client.initialize();
    this.ready = true;
  }

  async ensureThread() {
    await this.initialize();
    if (this.threadId) {
      try {
        await this.client.resumeThread({ threadId: this.threadId });
        return { threadId: this.threadId, fresh: false };
      } catch {
        this.threadId = '';
      }
    }
    const response = await this.client.startThread({ cwd: this.workspaceRoot });
    this.threadId = extractThreadId(response);
    if (!this.threadId) throw new Error('Codex 没有返回会话 ID');
    this.saveThreadId();
    return { threadId: this.threadId, fresh: true };
  }

  async models() {
    await this.initialize();
    const response = await this.client.listModels();
    return response?.result?.data || [];
  }

  chat(message, { memory = '', model = '', effort = '' } = {}) {
    const run = async () => {
      const { threadId, fresh } = await this.ensureThread();
      const context = memory.trim()
        ? `\n\nOmbre Brain 当前提供的相关记忆：\n${memory.trim()}`
        : '';
      const text = fresh
        ? `${SOREN_OPENING}${context}\n\n用户消息：${message}`
        : `${context}\n\n用户消息：${message}`.trim();
      const completion = this.waitForCompletion(threadId);
      const response = await this.client.sendUserMessage({
        threadId,
        text,
        model,
        effort,
        workspaceRoot: this.workspaceRoot,
      });
      const turnId = extractTurnId(response);
      return completion(turnId);
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => {});
    return result;
  }

  waitForCompletion(threadId) {
    let expectedTurnId = '';
    const result = new Promise((resolve, reject) => {
      let activeTurnId = '';
      const order = [];
      const textByItem = new Map();
      const cleanup = () => {
        unsubscribe();
        clearTimeout(timer);
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Codex 回复超时'));
      }, 10 * 60_000);
      const unsubscribe = this.client.onMessage((event) => {
        const params = event?.params || {};
        if (extractThreadIdFromParams(params) !== threadId) return;
        if (event?.method === 'turn/started' || event?.method === 'turn/start') {
          activeTurnId ||= extractTurnIdFromParams(params);
          return;
        }
        if (isAssistantItemCompleted(event)) {
          const itemId = params?.item?.id || `item-${order.length + 1}`;
          if (!textByItem.has(itemId)) order.push(itemId);
          textByItem.set(itemId, extractAssistantText(params));
          return;
        }
        if (event?.method === 'turn/failed') {
          cleanup();
          reject(new Error(extractFailureText(params)));
          return;
        }
        if (event?.method === 'turn/completed') {
          const completedTurnId = extractTurnIdFromParams(params);
          const trackedTurnId = expectedTurnId || activeTurnId;
          if (trackedTurnId && completedTurnId && completedTurnId !== trackedTurnId) return;
          cleanup();
          const reply = order.map((id) => textByItem.get(id) || '').filter(Boolean).join('\n\n').trim();
          resolve({ reply: reply || '已完成。', threadId, turnId: completedTurnId || trackedTurnId });
        }
      });
    });
    return (turnId) => {
      expectedTurnId = turnId || '';
      return result;
    };
  }
}

module.exports = { CodexAdapter };
