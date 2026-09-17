import type { IncomingMessage, ServerResponse } from 'node:http';
import type { TurnEvent } from '@soren/shared';

export interface RouteContext {req:IncomingMessage;res:ServerResponse;url:URL;path:string;}
export type RouteHandler=(context:RouteContext)=>boolean|Promise<boolean>;

export function createHttpTools(allowedOrigin:string){
  const cors=()=>({'Access-Control-Allow-Origin':allowedOrigin,'Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS'});
  const json=(res:ServerResponse,status:number,payload:unknown)=>{res.writeHead(status,{...cors(),'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(payload));};
  const body=async(req:IncomingMessage,limit=12_000_000)=>{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>limit)throw new Error('请求内容过大');}return raw?JSON.parse(raw):{};};
  const sse=(res:ServerResponse)=>{res.writeHead(200,{...cors(),'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive'});res.write(': connected\n\n');return(event:TurnEvent)=>res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);};
  return{cors,json,body,sse};
}

export type HttpTools=ReturnType<typeof createHttpTools>;
export const matchRoute=(pathname:string,pattern:RegExp)=>pathname.match(pattern);
export const cleanName=(value:unknown,fallback='未命名')=>String(value||'').trim().slice(0,80)||fallback;
