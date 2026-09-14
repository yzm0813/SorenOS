import { McpHttpClient, textFromToolResult } from '@soren/mcp-client';

export class OmbreMemory {
  readonly client: McpHttpClient;
  constructor(endpoint = 'http://127.0.0.1:18001/mcp') {
    this.client = new McpHttpClient({ id: 'ombre', name: 'Ombre Brain', endpoint });
  }
  async breath() { return textFromToolResult(await this.client.callTool('breath')); }
  async search(query: string) { return textFromToolResult(await this.client.callTool('breath_search', { query, max_results: 20, quotes: true })); }
  async hold(content: string, metadata: { title?: string; domain?: string; importance?: number } = {}) {
    return textFromToolResult(await this.client.callTool('hold', { content, title: metadata.title || '', domain: metadata.domain || '', importance: metadata.importance || 5 }));
  }
  async tools() { return this.client.listTools(); }
}
