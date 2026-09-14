export interface McpServerDefinition { id: string; name: string; endpoint: string; }

export class McpHttpClient {
  constructor(private readonly server: McpServerDefinition) {}

  async health() {
    try {
      const response = await fetch(this.server.endpoint.replace(/\/mcp\/?$/, '/health'), { signal: AbortSignal.timeout(1500) });
      return { configured: true, connected: response.ok };
    } catch { return { configured: true, connected: false }; }
  }

  async listTools() {
    return this.rpc('tools/list', {});
  }

  async callTool<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const result = await this.rpc('tools/call', { name, arguments: args });
    return result as T;
  }

  private async rpc(method: string, params: Record<string, unknown>) {
    const response = await fetch(this.server.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }),
      signal: AbortSignal.timeout(30_000)
    });
    if (!response.ok) throw new Error(`${this.server.name} returned ${response.status}`);
    const payload = await response.json() as { result?: unknown; error?: { message?: string } };
    if (payload.error) throw new Error(payload.error.message || `${this.server.name} error`);
    return payload.result;
  }
}

export function textFromToolResult(result: unknown): string {
  const content = (result as { content?: Array<{ type?: string; text?: string }> })?.content || [];
  return content.filter(item => item.type === 'text').map(item => item.text || '').join('\n');
}
