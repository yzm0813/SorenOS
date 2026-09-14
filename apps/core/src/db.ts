import Database from 'better-sqlite3';
import type { Conversation, ChatMessage, ToolPermission, WorkspaceProject } from '@soren/shared';
import { applyMigrations } from './migrations.js';

const now = () => new Date().toISOString();
const bool = (value: unknown) => Boolean(Number(value));

export class SorenDatabase {
  readonly db: Database.Database;
  constructor(file: string) {
    this.db = new Database(file);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    applyMigrations(this.db);
  }
  conversations(search = '', archived = false): Conversation[] {
    const rows = this.db.prepare(`SELECT * FROM conversations WHERE archived = ? AND title LIKE ? ORDER BY updated_at DESC`).all(archived ? 1 : 0, `%${search}%`) as any[];
    return rows.map(this.conversation);
  }
  conversationById(id: string): (Conversation & { memoryContext: string }) | null {
    const row = this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as any;
    return row ? { ...this.conversation(row), memoryContext: row.memory_context } : null;
  }
  createConversation(title: string, memoryContext = '') {
    const id = crypto.randomUUID(), at = now();
    this.db.prepare(`INSERT INTO conversations (id,title,memory_context,created_at,updated_at) VALUES (?,?,?,?,?)`).run(id, title, memoryContext, at, at);
    return this.conversationById(id)!;
  }
  updateConversation(id: string, patch: Record<string, unknown>) {
    const allowed: Record<string, string> = { title:'title', defaultModel:'default_model', thinkingMode:'thinking_mode', thinkingDepth:'thinking_depth', projectId:'project_id', archived:'archived', codexThreadId:'codex_thread_id', memoryContext:'memory_context' };
    const entries = Object.entries(patch).filter(([key]) => allowed[key]);
    if (!entries.length) return this.conversationById(id);
    const sets = entries.map(([key]) => `${allowed[key]} = ?`);
    const values = entries.map(([key, value]) => key === 'archived' ? (value ? 1 : 0) : value);
    this.db.prepare(`UPDATE conversations SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`).run(...values, now(), id);
    return this.conversationById(id);
  }
  messages(conversationId: string): ChatMessage[] {
    return (this.db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at').all(conversationId) as any[]).map(row => ({ id:row.id, conversationId:row.conversation_id, role:row.role, content:row.content, quotedMessageId:row.quoted_message_id, createdAt:row.created_at }));
  }
  addMessage(conversationId: string, role: string, content: string, quotedMessageId: string | null = null) {
    const id = crypto.randomUUID(), at = now();
    this.db.prepare('INSERT INTO messages VALUES (?,?,?,?,?,?)').run(id, conversationId, role, content, quotedMessageId, at);
    this.db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(at, conversationId);
    return { id, conversationId, role, content, quotedMessageId, createdAt: at } as ChatMessage;
  }
  addAttachment(messageId:string,item:{name:string;path:string;mime:string;size:number}) { this.db.prepare('INSERT INTO attachments VALUES (?,?,?,?,?,?,?)').run(crypto.randomUUID(),messageId,item.name,item.path,item.mime,item.size,now()); }
  updateMessage(id: string, content: string) { this.db.prepare('UPDATE messages SET content = ? WHERE id = ?').run(content, id); }
  deleteMessagesAfter(conversationId: string, messageId: string) {
    const row = this.db.prepare('SELECT created_at FROM messages WHERE id = ? AND conversation_id = ?').get(messageId, conversationId) as any;
    if (row) this.db.prepare('DELETE FROM messages WHERE conversation_id = ? AND created_at > ?').run(conversationId, row.created_at);
  }
  createTurn(id: string, conversationId: string, model: string) { this.db.prepare('INSERT INTO turns VALUES (?,?,?,?,?,?,NULL)').run(id, conversationId, null, 'running', model, now()); }
  finishTurn(id: string, status: string, codexTurnId = '') { this.db.prepare('UPDATE turns SET status=?, codex_turn_id=?, completed_at=? WHERE id=?').run(status, codexTurnId, now(), id); }
  projectRows(): any[] { return this.db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() as any[]; }
  addProject(project: Omit<WorkspaceProject,'gitStatus'>) { this.db.prepare('INSERT INTO projects VALUES (?,?,?,?,?,?,?)').run(project.id,project.name,project.directory,project.type,project.previewEntry,project.createdAt,project.updatedAt); }
  project(id: string): any { return this.db.prepare('SELECT * FROM projects WHERE id=?').get(id); }
  touchProject(id: string) { this.db.prepare('UPDATE projects SET updated_at=? WHERE id=?').run(now(), id); }
  settings() { return Object.fromEntries((this.db.prepare('SELECT key,value FROM settings').all() as any[]).map(row => [row.key, JSON.parse(row.value)])); }
  setSetting(key: string, value: unknown) { this.db.prepare('INSERT INTO settings VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').run(key,JSON.stringify(value),now()); }
  permissions(): ToolPermission[] { return this.db.prepare('SELECT server,tool,permission,risk FROM tool_permissions ORDER BY server,tool').all() as ToolPermission[]; }
  setPermission(item: ToolPermission) { this.db.prepare('INSERT INTO tool_permissions VALUES (?,?,?,?) ON CONFLICT(server,tool) DO UPDATE SET permission=excluded.permission,risk=excluded.risk').run(item.server,item.tool,item.permission,item.risk); }
  audit(server:string,tool:string,outcome:string,detail='') { this.db.prepare('INSERT INTO audit_logs VALUES (?,?,?,?,?,?)').run(crypto.randomUUID(),server,tool,outcome,detail.slice(0,500),now()); }
  audits() { return this.db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100').all(); }
  private conversation(row:any): Conversation { return { id:row.id,title:row.title,codexThreadId:row.codex_thread_id,defaultModel:row.default_model,thinkingMode:row.thinking_mode,thinkingDepth:row.thinking_depth,projectId:row.project_id,archived:bool(row.archived),createdAt:row.created_at,updatedAt:row.updated_at }; }
}
