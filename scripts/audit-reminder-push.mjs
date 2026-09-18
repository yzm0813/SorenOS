import Database from '../apps/core/node_modules/better-sqlite3/lib/index.js';

const file=process.argv[2]||'../data/soren.db',db=new Database(file,{readonly:true});
const reminders=db.prepare(`SELECT id,title,status,remind_at,source_conversation_id,created_at,fired_at,event_id FROM scheduled_reminders ORDER BY created_at DESC LIMIT 5`).all();
const events=db.prepare(`SELECT e.id,e.type,e.source_type,e.source_id,e.title,e.body,e.dedupe_key,e.occurred_at FROM domain_events e JOIN scheduled_reminders r ON r.id=e.source_id ORDER BY e.occurred_at DESC LIMIT 20`).all();
const notifications=db.prepare(`SELECT n.id,n.event_id,n.type,n.source_type,n.source_id,n.delivery_channel,n.status,n.title,n.body,n.conversation_id,n.message_id,n.created_at,n.delivered_at,n.dedupe_key FROM notifications n JOIN scheduled_reminders r ON r.id=n.source_id ORDER BY n.created_at DESC,n.delivery_channel LIMIT 40`).all();
const deliveries=db.prepare(`SELECT d.id,d.notification_id,d.subscription_id,d.provider,d.status,d.attempt_count,d.last_error_code,d.next_attempt_at,d.created_at,d.updated_at,d.sent_at,d.device_received_at,d.displayed_at,d.device_error_code FROM push_deliveries d JOIN notifications n ON n.id=d.notification_id JOIN scheduled_reminders r ON r.id=n.source_id ORDER BY d.created_at DESC LIMIT 20`).all();
const subscriptions=db.prepare(`SELECT id,device_label,created_at,updated_at,last_success_at,failure_count,disabled_at FROM push_subscriptions ORDER BY updated_at DESC`).all();
const settings=db.prepare(`SELECT key,value,updated_at FROM settings WHERE key IN ('systemNotificationsEnabled','proactivePaused') ORDER BY key`).all();
console.log(JSON.stringify({reminders,events,notifications,deliveries,subscriptions,settings},null,2));db.close();
