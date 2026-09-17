import type { RouteHandler } from '../http/index.js';
import { matchRoute } from '../http/index.js';

export function createMomentsRoutes({moments,socialLife,db,http}:{moments:any;socialLife:any;db:any;http:any}):RouteHandler{return async({req,res,url,path})=>{
  if(req.method==='GET'&&path==='/api/moments'){http.json(res,200,moments.feed(Number(url.searchParams.get('limit')||50),String(url.searchParams.get('actorId')||'')));return true;}
  if(req.method==='POST'&&path==='/api/moments'){const input=await http.body(req);try{http.json(res,201,{moment:moments.publishUser(input),unreadCount:moments.social.unreadCount()});}catch(error:any){http.json(res,400,{message:error?.message||'动态没有发布成功'});}return true;}
  if(req.method==='POST'&&path==='/api/moments/read'){const input=await http.body(req);http.json(res,200,moments.read(input.ids));return true;}
  if(req.method==='GET'&&path==='/api/moments/life'){http.json(res,200,{status:socialLife.status()});return true;}
  if(req.method==='PATCH'&&path==='/api/moments/life'){const input=await http.body(req);db.setSetting('momentsLifeEnabled',Boolean(input.enabled));http.json(res,200,{status:socialLife.status()});return true;}
  if(req.method==='POST'&&path==='/api/moments/life/pulse'){const input=await http.body(req);http.json(res,202,{status:await socialLife.pulse(Boolean(input.force))});return true;}
  let match=matchRoute(path,/^\/api\/moments\/([^/]+)\/comments$/);
  if(match&&req.method==='POST'){try{http.json(res,201,{comment:moments.commentUser(match[1],await http.body(req))});}catch(error:any){http.json(res,404,{message:error?.message||'动态不存在'});}return true;}
  match=matchRoute(path,/^\/api\/moments\/([^/]+)\/like$/);
  if(match&&req.method==='POST'){try{http.json(res,200,moments.likeUser(match[1]));}catch(error:any){http.json(res,404,{message:error?.message||'动态不存在'});}return true;}
  match=matchRoute(path,/^\/api\/moments\/([^/]+)$/);
  if(match&&req.method==='DELETE'){try{http.json(res,200,moments.deleteUser(match[1]));}catch(error:any){http.json(res,403,{message:error?.message||'不能删除这条动态'});}return true;}
  return false;
};}
