import type { RouteHandler } from '../http/index.js';
import { cleanName,matchRoute } from '../http/index.js';
import type { ConversationTurnService } from '../conversation-turn-service.js';

export function createConversationRoutes({db,turns,http}:{db:any;turns:ConversationTurnService;http:any}):RouteHandler{return async({req,res,url,path})=>{
  if(req.method==='GET'&&path==='/api/conversations'){http.json(res,200,{conversations:db.conversations(url.searchParams.get('q')||'',url.searchParams.get('archived')==='1')});return true;}
  if(req.method==='POST'&&path==='/api/conversations'){const input=await http.body(req);http.json(res,201,{conversation:db.createConversation(cleanName(input.title,'新对话'))});return true;}
  let match=matchRoute(path,/^\/api\/conversations\/([^/]+)$/);
  if(match&&req.method==='GET'){const conversation=db.conversationById(match[1]);if(!conversation)http.json(res,404,{message:'会话不存在'});else http.json(res,200,{conversation,messages:db.messages(match[1])});return true;}
  if(match&&req.method==='PATCH'){http.json(res,200,{conversation:db.updateConversation(match[1],await http.body(req))});return true;}
  match=matchRoute(path,/^\/api\/conversations\/([^/]+)\/turns$/);
  if(match&&req.method==='POST'){await turns.run(match[1],await http.body(req),res);return true;}
  match=matchRoute(path,/^\/api\/conversations\/([^/]+)\/turns\/([^/]+)\/cancel$/);
  if(match&&req.method==='POST'){if(await turns.cancel(match[2]))http.json(res,200,{cancelled:true});else http.json(res,404,{message:'这一轮已经结束'});return true;}
  return false;
};}
