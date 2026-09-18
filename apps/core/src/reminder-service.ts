import type { ScheduledReminder } from '@soren/shared';
import type { SorenDatabase } from './db.js';
import type { EventService } from './event-service.js';

const parse=<T>(value:unknown,fallback:T):T=>{try{return JSON.parse(String(value)) as T;}catch{return fallback;}};

export interface CreateReminderInput{
  title:string;
  remindAt:string;
  timezone:string;
  sourceConversationId?:string|null;
  sourceMessageId?:string|null;
  idempotencyKey:string;
  metadata?:Record<string,unknown>;
}

export class ReminderService{
  private timer:NodeJS.Timeout|null=null;
  private running=false;
  constructor(private readonly db:SorenDatabase,private readonly events:EventService,private readonly clock:()=>Date=()=>new Date()){}

  start(){if(this.timer)return;this.timer=setInterval(()=>void this.pulse(),5000);this.timer.unref();void this.pulse();}
  stop(){if(this.timer)clearInterval(this.timer);this.timer=null;}

  create(input:CreateReminderInput){const title=String(input.title||'').trim().slice(0,500),remindAt=new Date(input.remindAt),timezone=String(input.timezone||'').trim(),key=String(input.idempotencyKey||'').trim();if(!title)throw new Error('提醒内容不能为空');if(!Number.isFinite(remindAt.getTime())||remindAt.getTime()<=this.clock().getTime())throw new Error('提醒时间必须晚于现在');if(!timezone)throw new Error('提醒时区不能为空');if(!key)throw new Error('提醒缺少幂等键');const existing=this.byIdempotencyKey(key);if(existing)return existing;const id=crypto.randomUUID(),at=this.clock().toISOString();this.db.db.prepare(`INSERT INTO scheduled_reminders (id,title,status,remind_at,timezone,source_conversation_id,source_message_id,idempotency_key,metadata_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(id,title,'scheduled',remindAt.toISOString(),timezone,input.sourceConversationId||null,input.sourceMessageId||null,key,JSON.stringify(input.metadata||{}),at,at);const reminder=this.get(id)!;this.events.emit({type:'reminder.created',sourceType:'reminder',sourceId:id,title:'提醒已创建',body:title,dedupeKey:`reminder:created:${id}`,conversationId:reminder.sourceConversationId,payload:{remindAt:reminder.remindAt,timezone,sourceMessageId:reminder.sourceMessageId}});return reminder;}

  get(id:string){const row=this.db.db.prepare('SELECT * FROM scheduled_reminders WHERE id=?').get(id) as any;return row?this.map(row):null;}
  list(status=''){return(this.db.db.prepare(`SELECT * FROM scheduled_reminders WHERE (?='' OR status=?) ORDER BY CASE status WHEN 'scheduled' THEN 0 ELSE 1 END,remind_at DESC`).all(status,status) as any[]).map(row=>this.map(row));}
  cancel(id:string){const current=this.get(id);if(!current)return null;if(current.status!=='scheduled')return current;const at=this.clock().toISOString();this.db.db.prepare("UPDATE scheduled_reminders SET status='cancelled',updated_at=? WHERE id=? AND status='scheduled'").run(at,id);const reminder=this.get(id)!;this.events.emit({type:'reminder.cancelled',sourceType:'reminder',sourceId:id,title:'提醒已取消',body:reminder.title,dedupeKey:`reminder:cancelled:${id}`,conversationId:reminder.sourceConversationId,payload:{remindAt:reminder.remindAt}});return reminder;}

  async pulse(){if(this.running)return[];this.running=true;const fired:ScheduledReminder[]=[];try{const due=this.db.db.prepare("SELECT * FROM scheduled_reminders WHERE status='scheduled' AND remind_at<=? ORDER BY remind_at LIMIT 20").all(this.clock().toISOString()) as any[];for(const row of due){const reminder=this.map(row),result=this.events.emit({type:'reminder.due',sourceType:'reminder',sourceId:reminder.id,title:'Soren',body:`到时间了：${reminder.title}`,dedupeKey:`reminder:due:${reminder.id}`,conversationId:reminder.sourceConversationId,payload:{remindAt:reminder.remindAt,timezone:reminder.timezone,sourceMessageId:reminder.sourceMessageId}}),at=this.clock().toISOString();this.db.db.prepare("UPDATE scheduled_reminders SET status='fired',fired_at=COALESCE(fired_at,?),event_id=COALESCE(event_id,?),updated_at=? WHERE id=? AND status='scheduled'").run(at,result.event.id,at,reminder.id);fired.push(this.get(reminder.id)!);}}finally{this.running=false;}return fired;}

  private byIdempotencyKey(key:string){const row=this.db.db.prepare('SELECT * FROM scheduled_reminders WHERE idempotency_key=?').get(key) as any;return row?this.map(row):null;}
  private map(row:any):ScheduledReminder{return{id:row.id,title:row.title,status:row.status,remindAt:row.remind_at,timezone:row.timezone,sourceConversationId:row.source_conversation_id,sourceMessageId:row.source_message_id,createdAt:row.created_at,updatedAt:row.updated_at,firedAt:row.fired_at,eventId:row.event_id,metadata:parse(row.metadata_json,{})};}
}
