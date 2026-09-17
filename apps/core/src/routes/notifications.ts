import type { RouteHandler } from '../http/index.js';
import { matchRoute } from '../http/index.js';
import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';

const stages=new Set(['permission_request','permission_granted','service_worker_ready','push_subscription_created','subscription_post_started','subscription_post_success']);
const safe=(value:unknown,length=160)=>String(value||'').replace(/https?:\/\/\S+/gi,'[url]').replace(/[A-Za-z0-9_-]{32,}/g,'[redacted]').slice(0,length);

export function createNotificationRoutes({db,events,push,http,logRoot}:{db:any;events:any;push:any;http:any;logRoot:string}):RouteHandler{
  const logPush=async(entry:Record<string,unknown>)=>{const record={at:new Date().toISOString(),...entry};await appendFile(join(logRoot,'push-diagnostics.jsonl'),`${JSON.stringify(record)}\n`,'utf8').catch(()=>{});};
  return async({req,res,url,path})=>{
  if(req.method==='GET'&&path==='/api/events'){http.json(res,200,{events:events.events(Number(url.searchParams.get('limit')||50))});return true;}
  if(req.method==='GET'&&path==='/api/notifications'){http.json(res,200,{notifications:events.notifications({channel:url.searchParams.get('channel')||'',status:url.searchParams.get('status')||'',limit:Number(url.searchParams.get('limit')||50)})});return true;}
  const match=matchRoute(path,/^\/api\/notifications\/([^/]+)\/(delivered|read)$/);
  if(match&&req.method==='POST'){const notification=match[2]==='read'?events.markRead(match[1]):events.markDelivered(match[1]);if(!notification)http.json(res,404,{message:'通知不存在'});else http.json(res,200,{notification});return true;}
  if(req.method==='POST'&&path==='/api/proactive/messages'){
    if(db.setting('proactivePaused',false)){http.json(res,409,{message:'主动功能已暂停'});return true;}
    const input=await http.body(req),content=String(input.content||'').trim();if(!content){http.json(res,400,{message:'主动消息不能为空'});return true;}
    const sourceId=String(input.sourceId||crypto.randomUUID()),result=events.emit({type:'assistant.proactive_message',sourceType:'soren',sourceId,title:String(input.title||'Soren'),body:content.slice(0,4000),dedupeKey:input.dedupeKey?String(input.dedupeKey):undefined,conversationId:input.conversationId?String(input.conversationId):null,payload:{reason:String(input.reason||'')}}),chat=result.notifications.find((item:any)=>item.deliveryChannel==='chat');
    http.json(res,201,{...result,conversation:chat?.conversationId?db.conversationById(chat.conversationId):null});return true;
  }
  if(req.method==='GET'&&path==='/api/push/status'){http.json(res,200,push.status({supported:url.searchParams.get('supported')==='1',permission:url.searchParams.get('permission')||'unknown',subscriptionId:url.searchParams.get('subscriptionId')||''}));return true;}
  if(req.method==='POST'&&path==='/api/push/diagnostics'){const input=await http.body(req,4096),stage=stages.has(String(input.stage))?String(input.stage):'invalid',status=['started','success','failed'].includes(String(input.status))?String(input.status):'invalid';await logPush({source:'browser',stage,status,permission:safe(input.permission,20),error:safe(input.message),origin:safe(input.origin,100),standalone:Boolean(input.standalone)});http.json(res,202,{logged:true});return true;}
  if(req.method==='POST'&&path==='/api/push/subscribe'){await logPush({source:'core',stage:'subscription_post_started',status:'received'});try{const subscription=push.subscribe(await http.body(req));await logPush({source:'core',stage:'subscription_post_success',status:'success'});http.json(res,201,{subscription});}catch(error:any){await logPush({source:'core',stage:'subscription_post_started',status:'failed',error:safe(error?.message)});http.json(res,/配置/.test(error?.message||'')?503:400,{message:error?.message||'订阅失败'});}return true;}
  const pushDelete=matchRoute(path,/^\/api\/push\/subscriptions\/([^/]+)$/);
  if(pushDelete&&req.method==='DELETE'){if(push.unsubscribe(pushDelete[1]))http.json(res,200,{unsubscribed:true});else http.json(res,404,{message:'订阅不存在'});return true;}
  if(req.method==='POST'&&path==='/api/push/test'){if(!push.provider.configured()){http.json(res,503,{message:'Web Push 尚未配置 VAPID'});return true;}if(!db.setting('systemNotificationsEnabled',false)){http.json(res,409,{message:'请先打开系统通知并保存设置'});return true;}const id=crypto.randomUUID(),result=events.emit({type:'push.test',sourceType:'user',sourceId:id,title:'Soren',body:'如果你看到这条通知，说明这台设备已经和 Soren 连上了。',dedupeKey:`push:test:${id}`});http.json(res,202,result);return true;}
  return false;
};}
