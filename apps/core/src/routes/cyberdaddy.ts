import type { RouteHandler } from '../http/index.js';
import { matchRoute } from '../http/index.js';

export function createCyberDaddyRoutes({service,http}:{service:any;http:any}):RouteHandler{return async({req,res,path})=>{
  if(req.method==='GET'&&path==='/api/cyberdaddy'){http.json(res,200,service.snapshot());return true;}
  if(req.method==='PATCH'&&path==='/api/cyberdaddy'){http.json(res,200,service.updateConfig(await http.body(req)));return true;}
  if(req.method==='POST'&&path==='/api/cyberdaddy/pulse'){http.json(res,200,await service.pulse());return true;}
  let match=matchRoute(path,/^\/api\/cyberdaddy\/domains\/([^/]+)$/);
  if(match&&req.method==='PATCH'){const domain=service.updateDomain(match[1],await http.body(req));if(!domain)http.json(res,404,{message:'监督领域不存在'});else http.json(res,200,{domain,snapshot:service.snapshot()});return true;}
  if(req.method==='POST'&&path==='/api/commitments'){http.json(res,201,{commitment:service.createCommitment(await http.body(req)),snapshot:service.snapshot()});return true;}
  match=matchRoute(path,/^\/api\/commitments\/([^/]+)$/);
  if(match&&req.method==='PATCH'){const commitment=service.updateCommitment(match[1],await http.body(req));if(!commitment)http.json(res,404,{message:'承诺不存在'});else http.json(res,200,{commitment,snapshot:service.snapshot()});return true;}
  return false;
};}
