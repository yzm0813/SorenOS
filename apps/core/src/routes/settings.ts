import type { RouteHandler } from '../http/index.js';

export function createSettingsRoutes({db,persona,http}:{db:any;persona:any;http:any}):RouteHandler{return async({req,res,path})=>{
  if(req.method==='GET'&&path==='/api/settings'){http.json(res,200,{settings:db.settings(),persona:await persona.all()});return true;}
  if(req.method==='PUT'&&path==='/api/settings'){const input=await http.body(req);for(const[key,value]of Object.entries(input.settings||{}))db.setSetting(key,value);await persona.save(input.persona||{});http.json(res,200,{saved:true});return true;}
  return false;
};}
