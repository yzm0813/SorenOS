import type { RouteHandler } from '../http/index.js';
import { matchRoute } from '../http/index.js';

export function createNotificationRoutes({db,events,http}:{db:any;events:any;http:any}):RouteHandler{return async({req,res,url,path})=>{
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
  return false;
};}
