import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import { SorenDatabase } from './db.js';
import { latestSchemaVersion } from './migrations.js';

function tempDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'soren-migration-'));
  return { directory, file: join(directory, 'soren.db') };
}

test('creates the current schema for a fresh database', () => {
  const { directory, file } = tempDatabase();
  try {
    const store = new SorenDatabase(file);
    const tables = store.db.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all().map((row: any) => row.name);
    assert.equal(store.db.pragma('user_version', { simple: true }), latestSchemaVersion);
    assert.ok(tables.includes('conversations'));
    assert.ok(tables.includes('schema_migrations'));
    store.db.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('adopts the legacy schema without losing existing rows', () => {
  const { directory, file } = tempDatabase();
  try {
    const legacy = new Database(file);
    legacy.exec(`
      CREATE TABLE conversations (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, codex_thread_id TEXT,
        default_model TEXT NOT NULL DEFAULT '', thinking_mode TEXT NOT NULL DEFAULT 'auto',
        thinking_depth TEXT NOT NULL DEFAULT 'quick', project_id TEXT, memory_context TEXT NOT NULL DEFAULT '',
        archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
    `);
    legacy.prepare('INSERT INTO conversations (id,title,created_at,updated_at) VALUES (?,?,?,?)')
      .run('kept-conversation', '保留的会话', '2026-09-14T00:00:00.000Z', '2026-09-14T00:00:00.000Z');
    legacy.close();

    const migrated = new SorenDatabase(file);
    assert.equal(migrated.db.pragma('user_version', { simple: true }), latestSchemaVersion);
    assert.equal(migrated.conversationById('kept-conversation')?.title, '保留的会话');
    assert.deepEqual(migrated.db.prepare('SELECT version,name FROM schema_migrations ORDER BY version').all(), [{ version: 1, name: 'baseline_schema' },{version:2,name:'home_notes'},{version:3,name:'shared_memory_index'}]);
    migrated.db.close();

    const reopened = new SorenDatabase(file);
    assert.equal(reopened.conversations().length, 1);
    reopened.db.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('keeps the current Home note across restarts', () => {
  const { directory, file } = tempDatabase();
  try {
    const store = new SorenDatabase(file);
    const note = store.setHomeNote('留在 Home 的话');
    assert.equal(store.audits().length,0);
    store.db.close();
    const reopened = new SorenDatabase(file);
    assert.equal(reopened.homeNote()?.id, note.id);
    assert.equal(reopened.homeNote()?.content, '留在 Home 的话');
    reopened.db.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
