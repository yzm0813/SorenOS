import type { ToolPermission } from '@soren/shared';
import type { RouteHandler } from '../http/index.js';

export function createMcpRoutes({ombre,memory,db,http}:{ombre:any;memory:any;db:any;http:any}):RouteHandler{return async({req,res,path})=>{
  if(req.method==='GET'&&path==='/api/mcp'){const tools:any=await ombre.tools().catch(()=>({tools:[]}));http.json(res,200,{servers:[{id:'ombre',name:'Ombre Brain',status:await memory.status(),tools:tools?.tools||tools?.result?.tools||[]}],permissions:db.permissions(),audit:db.audits()});return true;}
  if(req.method==='PUT'&&path==='/api/mcp/permissions'){const item=await http.body(req) as ToolPermission;if(!['always_allow','ask_each_time','disabled'].includes(item.permission)){http.json(res,400,{message:'无效权限'});return true;}db.setPermission(item);db.audit(item.server,item.tool,'permission_changed',item.permission);http.json(res,200,{permission:item});return true;}
  return false;
};}
