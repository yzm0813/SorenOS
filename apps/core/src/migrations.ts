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
  {
    version: 4,
    name: 'moments_feed',
    sql: `
      CREATE TABLE IF NOT EXISTS moments (
        id TEXT PRIMARY KEY,
        author TEXT NOT NULL,
        content TEXT NOT NULL,
        location TEXT NOT NULL DEFAULT '',
        world_context TEXT NOT NULL DEFAULT '',
        read_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS moment_media (
        id TEXT PRIMARY KEY,
        moment_id TEXT NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
        kind TEXT NOT NULL DEFAULT 'image',
        path TEXT NOT NULL,
        mime TEXT NOT NULL,
        size INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS moment_comments (
        id TEXT PRIMARY KEY,
        moment_id TEXT NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
        author TEXT NOT NULL,
        content TEXT NOT NULL,
        reply_to_comment_id TEXT REFERENCES moment_comments(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_moments_created ON moments(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_moments_unread ON moments(author, read_at, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_moment_media_post ON moment_media(moment_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_moment_comments_post ON moment_comments(moment_id, created_at);
    `,
  },
  {
    version: 5,
    name: 'social_life_engine',
    sql: `
      CREATE TABLE IF NOT EXISTS social_actors (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        nickname TEXT NOT NULL,
        avatar TEXT NOT NULL,
        personality TEXT NOT NULL,
        relation_to_soren TEXT NOT NULL DEFAULT '',
        relation_to_user TEXT NOT NULL DEFAULT '',
        memory_json TEXT NOT NULL DEFAULT '[]',
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      ALTER TABLE moments ADD COLUMN author_id TEXT NOT NULL DEFAULT '';
      ALTER TABLE moments ADD COLUMN image_description TEXT NOT NULL DEFAULT '';
      ALTER TABLE moments ADD COLUMN motivation TEXT NOT NULL DEFAULT '';
      ALTER TABLE moments ADD COLUMN source_event_id TEXT;
      ALTER TABLE moments ADD COLUMN fingerprint TEXT NOT NULL DEFAULT '';
      ALTER TABLE moments ADD COLUMN deleted_at TEXT;
      ALTER TABLE moment_comments ADD COLUMN author_id TEXT NOT NULL DEFAULT '';
      CREATE TABLE IF NOT EXISTS moment_likes (
        id TEXT PRIMARY KEY,
        moment_id TEXT NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
        actor_id TEXT NOT NULL REFERENCES social_actors(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        UNIQUE(moment_id, actor_id)
      );
      CREATE TABLE IF NOT EXISTS social_events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        actor_id TEXT,
        target_id TEXT,
        summary TEXT NOT NULL,
        importance INTEGER NOT NULL DEFAULT 5,
        privacy TEXT NOT NULL DEFAULT 'private',
        due_at TEXT,
        consumed_at TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS social_actor_state (
        actor_id TEXT PRIMARY KEY REFERENCES social_actors(id) ON DELETE CASCADE,
        mood TEXT NOT NULL DEFAULT '平静',
        energy INTEGER NOT NULL DEFAULT 60,
        focus TEXT NOT NULL DEFAULT '',
        current_activity TEXT NOT NULL DEFAULT '',
        last_post_at TEXT,
        last_interaction_at TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_social_events_pending ON social_events(consumed_at, due_at, importance DESC, created_at);
      CREATE INDEX IF NOT EXISTS idx_moments_actor_created ON moments(author_id, deleted_at, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_moment_likes_post ON moment_likes(moment_id, created_at);
      UPDATE moments SET author_id=CASE author WHEN 'soren' THEN 'soren' ELSE 'user' END WHERE author_id='';
      UPDATE moment_comments SET author_id=CASE author WHEN 'soren' THEN 'soren' ELSE 'user' END WHERE author_id='';
    `,
  },
  {
    version: 6,
    name: 'event_notification_layer',
    sql: `
      CREATE TABLE IF NOT EXISTS domain_events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        payload_json TEXT NOT NULL DEFAULT '{}',
        dedupe_key TEXT NOT NULL UNIQUE,
        occurred_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES domain_events(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL DEFAULT '',
        delivery_channel TEXT NOT NULL,
        status TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        conversation_id TEXT,
        created_at TEXT NOT NULL,
        delivered_at TEXT,
        read_at TEXT,
        dedupe_key TEXT NOT NULL,
        UNIQUE(dedupe_key, delivery_channel)
      );
      CREATE INDEX IF NOT EXISTS idx_domain_events_occurred ON domain_events(occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_delivery ON notifications(delivery_channel,status,created_at);
      CREATE INDEX IF NOT EXISTS idx_notifications_event ON notifications(event_id);
    `,
  },
  {
    version: 7,
    name: 'cyberdaddy_supervision',
    sql: `
      CREATE TABLE IF NOT EXISTS cyberdaddy_domains (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 0,
        intensity TEXT NOT NULL DEFAULT 'normal',
        settings_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS commitments (
        id TEXT PRIMARY KEY,
        domain_id TEXT NOT NULL REFERENCES cyberdaddy_domains(id),
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        target_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        source_conversation_id TEXT,
        last_followup_at TEXT,
        next_followup_at TEXT,
        followup_count INTEGER NOT NULL DEFAULT 0,
        metadata_json TEXT NOT NULL DEFAULT '{}'
      );
      CREATE TABLE IF NOT EXISTS commitment_followups (
        id TEXT PRIMARY KEY,
        commitment_id TEXT NOT NULL REFERENCES commitments(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        message TEXT NOT NULL DEFAULT '',
        reason TEXT NOT NULL DEFAULT '',
        event_id TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_commitments_due ON commitments(status,target_at,next_followup_at);
      CREATE INDEX IF NOT EXISTS idx_commitments_domain ON commitments(domain_id,status,updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_commitment_followups_created ON commitment_followups(commitment_id,created_at DESC);
    `,
  },
  {
    version: 8,
    name: 'recurring_commitments',
    sql: `
      ALTER TABLE commitments ADD COLUMN recurrence TEXT NOT NULL DEFAULT 'none';
      ALTER TABLE commitments ADD COLUMN recurrence_time TEXT;
      ALTER TABLE commitments ADD COLUMN cycle_key TEXT;
      ALTER TABLE commitments ADD COLUMN cycle_followup_count INTEGER NOT NULL DEFAULT 0;
      CREATE INDEX IF NOT EXISTS idx_commitments_recurrence ON commitments(status,recurrence,cycle_key);
    `,
  },
  {
    version: 9,
    name: 'soren_self_state',
    sql: `
      CREATE TABLE IF NOT EXISTS soren_self_state (
        id TEXT PRIMARY KEY CHECK(id='soren'),
        current_interests_json TEXT NOT NULL DEFAULT '[]',
        ongoing_personal_threads_json TEXT NOT NULL DEFAULT '[]',
        recent_reflections_json TEXT NOT NULL DEFAULT '[]',
        digital_life_state TEXT NOT NULL DEFAULT '',
        active_personal_projects_json TEXT NOT NULL DEFAULT '[]',
        social_relationships_json TEXT NOT NULL DEFAULT '{}',
        last_meaningful_life_events_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 10,
    name: 'web_push_delivery',
    sql: `
      ALTER TABLE notifications ADD COLUMN message_id TEXT;
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id TEXT PRIMARY KEY,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        device_label TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_success_at TEXT,
        failure_count INTEGER NOT NULL DEFAULT 0,
        disabled_at TEXT
      );
      CREATE TABLE IF NOT EXISTS push_deliveries (
        id TEXT PRIMARY KEY,
        notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
        subscription_id TEXT NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempt_count INTEGER NOT NULL DEFAULT 0,
        last_error_code TEXT,
        next_attempt_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sent_at TEXT,
        UNIQUE(notification_id,subscription_id)
      );
      CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON push_subscriptions(disabled_at,updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_push_deliveries_pending ON push_deliveries(status,next_attempt_at,created_at);
    `,
  },
  {
    version: 11,
    name: 'scheduled_reminders',
    sql: `
      CREATE TABLE IF NOT EXISTS scheduled_reminders (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'scheduled',
        remind_at TEXT NOT NULL,
        timezone TEXT NOT NULL,
        source_conversation_id TEXT,
        source_message_id TEXT,
        idempotency_key TEXT NOT NULL UNIQUE,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        fired_at TEXT,
        event_id TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_due ON scheduled_reminders(status,remind_at);
      CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_source ON scheduled_reminders(source_conversation_id,created_at DESC);
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
