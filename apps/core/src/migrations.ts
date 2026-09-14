import type Database from 'better-sqlite3';

export type SchemaMigration = {
  version: number;
  name: string;
  sql: string;
};

export const migrations: SchemaMigration[] = [
  {
    version: 1,
    name: 'baseline_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, codex_thread_id TEXT,
        default_model TEXT NOT NULL DEFAULT '', thinking_mode TEXT NOT NULL DEFAULT 'auto',
        thinking_depth TEXT NOT NULL DEFAULT 'quick', project_id TEXT, memory_context TEXT NOT NULL DEFAULT '',
        archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL, content TEXT NOT NULL, quoted_message_id TEXT, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS turns (
        id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        codex_turn_id TEXT, status TEXT NOT NULL, model TEXT NOT NULL DEFAULT '', started_at TEXT NOT NULL, completed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, directory TEXT NOT NULL UNIQUE, type TEXT NOT NULL,
        preview_entry TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY, message_id TEXT REFERENCES messages(id) ON DELETE CASCADE, name TEXT NOT NULL,
        path TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS tool_permissions (
        server TEXT NOT NULL, tool TEXT NOT NULL, permission TEXT NOT NULL, risk TEXT NOT NULL,
        PRIMARY KEY(server, tool)
      );
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY, server TEXT NOT NULL, tool TEXT NOT NULL, outcome TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_conversations_archived_updated ON conversations(archived, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_turns_conversation_started ON turns(conversation_id, started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
    `,
  },
  {
    version: 2,
    name: 'home_notes',
    sql: `
      CREATE TABLE IF NOT EXISTS home_notes (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_home_notes_current ON home_notes(archived_at, updated_at DESC);
    `,
  },
  {
    version: 3,
    name: 'shared_memory_index',
    sql: `
      CREATE TABLE IF NOT EXISTS memory_records (
        id TEXT PRIMARY KEY,
        fingerprint TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL,
        scope TEXT NOT NULL DEFAULT 'long_term',
        project_id TEXT,
        importance INTEGER NOT NULL DEFAULT 5,
        pinned INTEGER NOT NULL DEFAULT 0,
        source_type TEXT NOT NULL,
        source_id TEXT,
        provenance TEXT NOT NULL DEFAULT '',
        remote_id TEXT,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_memory_active_importance ON memory_records(archived, pinned DESC, importance DESC, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_memory_project ON memory_records(project_id, archived, updated_at DESC);
    `,
  },
];

export const latestSchemaVersion = migrations.at(-1)?.version ?? 0;

export function applyMigrations(db: Database.Database): number[] {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const current = db.pragma('user_version', { simple: true }) as number;
  if (current > latestSchemaVersion) {
    throw new Error(`Database schema ${current} is newer than this Soren build (${latestSchemaVersion}).`);
  }

  const applied: number[] = [];
  for (const migration of migrations) {
    if (migration.version <= current) continue;
    db.transaction(() => {
      db.exec(migration.sql);
      db.prepare('INSERT OR IGNORE INTO schema_migrations (version,name,applied_at) VALUES (?,?,?)')
        .run(migration.version, migration.name, new Date().toISOString());
      db.pragma(`user_version = ${migration.version}`);
    })();
    applied.push(migration.version);
  }

  db.pragma('optimize');
  return applied;
}
