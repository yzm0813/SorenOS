import type { IncomingMessage,ServerResponse } from 'node:http';
import { readFile,stat } from 'node:fs/promises';
import { extname,join,normalize } from 'node:path';
import type { HttpTools } from './http/index.js';

export function createStaticHandler(webDist:string,http:HttpTools){return async(req:IncomingMessage,res:ServerResponse)=>{const url=new URL(req.url||'/',`http://${req.headers.host}`),requestPath=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1)),target=normalize(join(webDist,requestPath));if(!target.startsWith(normalize(webDist)))return http.json(res,403,{message:'Forbidden'});try{const info=await stat(target),file=info.isDirectory()?join(target,'index.html'):target,content=await readFile(file),mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(content);}catch{http.json(res,404,{message:'Not found'});}};}
