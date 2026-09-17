import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import { SorenDatabase } from './db.js';
import { latestSchemaVersion, migrations } from './migrations.js';

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
    assert.ok(tables.includes('moments'));
    assert.ok(tables.includes('moment_comments'));
    assert.ok(tables.includes('social_actors'));
    assert.ok(tables.includes('social_events'));
    assert.ok(tables.includes('domain_events'));
    assert.ok(tables.includes('notifications'));
    assert.ok(tables.includes('cyberdaddy_domains'));
    assert.ok(tables.includes('commitments'));
    assert.ok(tables.includes('commitment_followups'));
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
    assert.deepEqual(migrated.db.prepare('SELECT version,name FROM schema_migrations ORDER BY version').all(), [{ version: 1, name: 'baseline_schema' },{version:2,name:'home_notes'},{version:3,name:'shared_memory_index'},{version:4,name:'moments_feed'},{version:5,name:'social_life_engine'},{version:6,name:'event_notification_layer'},{version:7,name:'cyberdaddy_supervision'},{version:8,name:'recurring_commitments'}]);
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

test('upgrades Phase 3 Moments rows without changing their identity or timestamp',()=>{const{directory,file}=tempDatabase();try{const phase4=new Database(file);for(const migration of migrations.filter(item=>item.version<=4))phase4.exec(migration.sql);phase4.pragma('user_version = 4');phase4.prepare('INSERT INTO moments (id,author,content,location,world_context,read_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run('kept-moment','soren','保留这条动态','','',null,'2026-09-15T12:00:00.000Z','2026-09-15T12:00:00.000Z');phase4.close();const migrated=new SorenDatabase(file),row=migrated.db.prepare('SELECT id,author_id,content,created_at FROM moments WHERE id=?').get('kept-moment') as any;assert.deepEqual(row,{id:'kept-moment',author_id:'soren',content:'保留这条动态',created_at:'2026-09-15T12:00:00.000Z'});assert.equal(migrated.db.pragma('user_version',{simple:true}),8);migrated.db.close();}finally{rmSync(directory,{recursive:true,force:true});}});

test('migrates a real v7 commitment database to v8 without changing existing data',()=>{const{directory,file}=tempDatabase();try{const v7=new Database(file);for(const migration of migrations.filter(item=>item.version<=7))v7.exec(migration.sql);v7.pragma('user_version = 7');const at='2026-09-16T10:00:00.000Z';v7.prepare('INSERT INTO cyberdaddy_domains VALUES (?,?,?,?,?,?,?)').run('study','学习',1,'normal','{}',at,at);v7.prepare(`INSERT INTO commitments (id,domain_id,description,status,target_at,created_at,updated_at,completed_at,source_conversation_id,last_followup_at,next_followup_at,followup_count,metadata_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('active-v7','study','保留进行中的承诺','active','2026-09-17T02:00:00.000Z',at,at,null,null,at,'2026-09-16T14:00:00.000Z',2,'{}');v7.prepare(`INSERT INTO commitments (id,domain_id,description,status,target_at,created_at,updated_at,completed_at,source_conversation_id,last_followup_at,next_followup_at,followup_count,metadata_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('completed-v7','study','保留完成的承诺','completed','2026-09-15T02:00:00.000Z',at,at,at,null,at,null,1,'{}');v7.prepare('INSERT INTO commitment_followups VALUES (?,?,?,?,?,?,?)').run('followup-v7','active-v7','FOLLOW_UP','仍然保留','v7 history',null,at);v7.close();const migrated=new SorenDatabase(file),active=migrated.db.prepare('SELECT * FROM commitments WHERE id=?').get('active-v7') as any,completed=migrated.db.prepare('SELECT * FROM commitments WHERE id=?').get('completed-v7') as any,history=migrated.db.prepare('SELECT * FROM commitment_followups WHERE id=?').get('followup-v7') as any;assert.equal(active.description,'保留进行中的承诺');assert.equal(active.status,'active');assert.equal(active.target_at,'2026-09-17T02:00:00.000Z');assert.equal(active.followup_count,2);assert.equal(active.recurrence,'none');assert.equal(active.cycle_followup_count,0);assert.equal(completed.status,'completed');assert.equal(history.commitment_id,'active-v7');assert.equal(history.message,'仍然保留');migrated.db.close();const reopened=new SorenDatabase(file),rows=reopened.db.prepare('SELECT id,description,status,target_at,followup_count,recurrence,cycle_followup_count FROM commitments ORDER BY id').all() as any[];assert.deepEqual(rows.map(row=>row.id),['active-v7','completed-v7']);assert.equal((reopened.db.prepare('SELECT COUNT(*) count FROM commitment_followups').get() as any).count,1);reopened.db.close();}finally{rmSync(directory,{recursive:true,force:true});}});
