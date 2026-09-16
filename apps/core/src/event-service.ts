import type { DeliveryChannel, DomainEvent, NotificationRecord, NotificationStatus } from '@soren/shared';
import type { SorenDatabase } from './db.js';

const now=()=>new Date().toISOString();
const parse=<T>(value:unknown,fallback:T):T=>{try{return JSON.parse(String(value)) as T;}catch{return fallback;}};

export interface EmitEventInput {
  type:string;
  sourceType:string;
  sourceId?:string;
  title?:string;
  body?:string;
  payload?:Record<string,unknown>;
  dedupeKey?:string;
  conversationId?:string|null;
}

const deliveryPolicy:Record<string,DeliveryChannel[]>={
  'home_note.created':['in_app'],
  'moment.created':['in_app'],
  'assistant.proactive_message':['chat','system'],
  'reminder.important':['chat','system'],
  'cyberdaddy.followup_due':['chat','system'],
};

export class EventService {
  constructor(private readonly db:SorenDatabase){}

  emit(input:EmitEventInput){return this.db.db.transaction(()=>{
    const sourceId=String(input.sourceId||''),dedupeKey=String(input.dedupeKey||`${input.type}:${input.sourceType}:${sourceId||crypto.randomUUID()}`),at=now(),eventId=crypto.randomUUID();
    this.db.db.prepare(`INSERT OR IGNORE INTO domain_events (id,type,source_type,source_id,title,body,payload_json,dedupe_key,occurred_at) VALUES (?,?,?,?,?,?,?,?,?)`).run(eventId,input.type,input.sourceType,sourceId,String(input.title||'').slice(0,200),String(input.body||'').slice(0,4000),JSON.stringify(input.payload||{}),dedupeKey,at);
    const eventRow=this.db.db.prepare('SELECT * FROM domain_events WHERE dedupe_key=?').get(dedupeKey) as any;
    for(const channel of deliveryPolicy[input.type]||['in_app']){
      const enabled=channel!=='system'||this.db.setting('systemNotificationsEnabled',false),status:NotificationStatus=channel==='system'&&!enabled?'suppressed':channel==='system'||channel==='chat'?'pending':'delivered';
      this.db.db.prepare(`INSERT OR IGNORE INTO notifications (id,event_id,type,source_type,source_id,delivery_channel,status,title,body,conversation_id,created_at,delivered_at,read_at,dedupe_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(crypto.randomUUID(),eventRow.id,input.type,input.sourceType,sourceId,channel,status,String(input.title||'').slice(0,200),String(input.body||'').slice(0,4000),input.conversationId||null,at,status==='delivered'?at:null,null,dedupeKey);
    }
    const chat=this.db.db.prepare("SELECT * FROM notifications WHERE event_id=? AND delivery_channel='chat' AND status='pending'").get(eventRow.id) as any;
    if(chat){const conversation=this.ensureProactiveConversation(input.conversationId||chat.conversation_id),message=this.db.addMessage(conversation.id,'assistant',String(input.body||input.title||'').trim());this.db.db.prepare("UPDATE notifications SET status='delivered',conversation_id=?,delivered_at=? WHERE id=?").run(conversation.id,message.createdAt,chat.id);}
    return{event:this.mapEvent(eventRow),notifications:this.notificationsForEvent(eventRow.id)};
  })();}

  events(limit=50){return(this.db.db.prepare('SELECT * FROM domain_events ORDER BY occurred_at DESC LIMIT ?').all(Math.max(1,Math.min(200,limit))) as any[]).map(this.mapEvent);}
  notifications(input:{channel?:string;status?:string;limit?:number}={}){const channel=String(input.channel||''),status=String(input.status||''),limit=Math.max(1,Math.min(200,Number(input.limit)||50));return(this.db.db.prepare(`SELECT * FROM notifications WHERE (?='' OR delivery_channel=?) AND (?='' OR status=?) ORDER BY created_at DESC LIMIT ?`).all(channel,channel,status,status,limit) as any[]).map(this.mapNotification);}
  markDelivered(id:string){const at=now();this.db.db.prepare("UPDATE notifications SET status=CASE WHEN status='read' THEN status ELSE 'delivered' END,delivered_at=COALESCE(delivered_at,?) WHERE id=? AND status<>'suppressed'").run(at,id);return this.notification(id);}
  markRead(id:string){const at=now();this.db.db.prepare("UPDATE notifications SET status='read',delivered_at=COALESCE(delivered_at,?),read_at=? WHERE id=? AND status<>'suppressed'").run(at,at,id);return this.notification(id);}
  private ensureProactiveConversation(preferred:string|null){if(preferred){const found=this.db.conversationById(preferred);if(found)return found;}const saved=this.db.setting<string>('proactiveConversationId','');if(saved){const found=this.db.conversationById(saved);if(found)return found;}const conversation=this.db.createConversation('Soren 主动消息');this.db.setSetting('proactiveConversationId',conversation.id);return conversation;}
  private notificationsForEvent(eventId:string){return(this.db.db.prepare('SELECT * FROM notifications WHERE event_id=? ORDER BY delivery_channel').all(eventId) as any[]).map(this.mapNotification);}
  private notification(id:string){const row=this.db.db.prepare('SELECT * FROM notifications WHERE id=?').get(id) as any;return row?this.mapNotification(row):null;}
  private mapEvent=(row:any):DomainEvent=>({id:row.id,type:row.type,sourceType:row.source_type,sourceId:row.source_id,title:row.title,body:row.body,payload:parse(row.payload_json,{}),dedupeKey:row.dedupe_key,occurredAt:row.occurred_at});
  private mapNotification=(row:any):NotificationRecord=>({id:row.id,eventId:row.event_id,type:row.type,sourceType:row.source_type,sourceId:row.source_id,deliveryChannel:row.delivery_channel,status:row.status,title:row.title,body:row.body,conversationId:row.conversation_id,createdAt:row.created_at,deliveredAt:row.delivered_at,readAt:row.read_at,dedupeKey:row.dedupe_key});
}
