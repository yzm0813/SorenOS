import { McpHttpClient, textFromToolResult } from '@soren/mcp-client';

export class OmbreMemory {
  readonly client: McpHttpClient;
  constructor(endpoint = 'http://127.0.0.1:18001/mcp') {
    this.client = new McpHttpClient({ id: 'ombre', name: 'Ombre Brain', endpoint });
  }
  async breath() { return textFromToolResult(await this.client.callTool('breath')); }
  async search(query: string, options: { maxResults?: number; automatic?: boolean; withIds?: boolean; domain?: string } = {}) { return textFromToolResult(await this.client.callTool('breath_search', { query, domain:options.domain||'', max_results:options.maxResults||8, quotes:false, mode:options.automatic?'automatic':'manual', with_ids:Boolean(options.withIds) })); }
  async hold(content: string, metadata: { title?: string; domain?: string; importance?: number; pinned?: boolean; whyRemembered?:string } = {}) {
    return textFromToolResult(await this.client.callTool('hold', { content, title: metadata.title || '', domain: metadata.domain || '', importance: metadata.importance || 5, pinned:Boolean(metadata.pinned), why_remembered:metadata.whyRemembered||'' }));
  }
  async trace(bucketId:string, patch:Record<string,unknown>){return textFromToolResult(await this.client.callTool('trace',{bucket_id:bucketId,...patch}));}
  async tools() { return this.client.listTools(); }
}
