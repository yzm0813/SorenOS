import type { RouteHandler } from '../http/index.js';
import { matchRoute } from '../http/index.js';

export function createMemoryRoutes({memory,http}:{memory:any;http:any}):RouteHandler{return async({req,res,url,path})=>{
  if(req.method==='POST'&&path==='/api/memory/breath'){http.json(res,200,await memory.surface());return true;}
  if(req.method==='POST'&&path==='/api/memory/search'){const input=await http.body(req);http.json(res,200,await memory.recall({message:String(input.query||''),conversationId:'memory-ui',projectId:null}));return true;}
  if(req.method==='POST'&&path==='/api/memory/hold'){const input=await http.body(req),result=await memory.remember({content:String(input.content||''),title:String(input.title||''),scope:input.scope||'long_term',projectId:input.projectId||null,importance:Number(input.importance)||6,pinned:Boolean(input.pinned),sourceType:'manual',provenance:'Memory UI'});http.json(res,200,{content:result.degraded?'已保存在本地，Ombre 恢复后可同步。':'已写入共享记忆。',...result});return true;}
  if(req.method==='GET'&&path==='/api/memories'){http.json(res,200,{records:memory.list(url.searchParams.get('q')||''),status:await memory.status()});return true;}
  const match=matchRoute(path,/^\/api\/memories\/([^/]+)$/);
  if(match&&req.method==='PATCH'){const record=await memory.update(match[1],await http.body(req));if(!record)http.json(res,404,{message:'记忆不存在'});else http.json(res,200,{record});return true;}
  if(req.method==='POST'&&path==='/api/memory/seed/preview'){const input=await http.body(req);http.json(res,200,memory.previewSeed(input.seed));return true;}
  if(req.method==='POST'&&path==='/api/memory/seed/import'){const input=await http.body(req);http.json(res,200,await memory.importSeed(input.seed));return true;}
  return false;
};}
