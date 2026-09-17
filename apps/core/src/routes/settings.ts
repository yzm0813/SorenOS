import type { RouteHandler } from '../http/index.js';

export function createSettingsRoutes({db,persona,selfState,http}:{db:any;persona:any;selfState:any;http:any}):RouteHandler{return async({req,res,path})=>{
  if(req.method==='GET'&&path==='/api/settings'){http.json(res,200,{settings:db.settings(),persona:await persona.all(),personaVersion:await persona.version(),selfState:selfState.get()});return true;}
  if(req.method==='PUT'&&path==='/api/settings'){const input=await http.body(req);for(const[key,value]of Object.entries(input.settings||{}))db.setSetting(key,value);http.json(res,200,{saved:true,personaReadOnly:true});return true;}
  return false;
};}
