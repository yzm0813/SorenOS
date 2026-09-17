import { extname } from 'node:path';
import { slugifyProject } from '@soren/workspace';
import type { RouteHandler } from '../http/index.js';
import { cleanName,matchRoute } from '../http/index.js';

const projectRow=(row:any)=>({id:row.id,name:row.name,directory:row.directory,type:row.type,previewEntry:row.preview_entry,createdAt:row.created_at,updatedAt:row.updated_at});

export function createWorkspaceRoutes({db,workspace,http}:{db:any;workspace:any;http:any}):RouteHandler{return async({req,res,url,path})=>{
  if(req.method==='GET'&&path==='/api/projects'){const projects=await Promise.all(db.projectRows().map(async(row:any)=>({...projectRow(row),gitStatus:(await workspace.changedPaths(row.id)).length?'changed':'clean'})));http.json(res,200,{projects});return true;}
  if(req.method==='POST'&&path==='/api/projects'){const input=await http.body(req),name=cleanName(input.name,'新项目'),type=['web','markdown','files'].includes(input.type)?input.type:'files',id=slugifyProject(name),at=new Date().toISOString();await workspace.createProject(id,name,type);const project={id,name,directory:id,type,previewEntry:type==='web'?'index.html':type==='markdown'?'README.md':null,createdAt:at,updatedAt:at};db.addProject(project);http.json(res,201,{project:{...project,gitStatus:'clean'}});return true;}
  let match=matchRoute(path,/^\/api\/projects\/([^/]+)$/);
  if(match&&req.method==='GET'){const project=db.project(match[1]);if(!project)http.json(res,404,{message:'项目不存在'});else http.json(res,200,{project:projectRow(project),files:await workspace.listFiles(match[1])});return true;}
  match=matchRoute(path,/^\/api\/projects\/([^/]+)\/files$/);if(match&&req.method==='GET'){http.json(res,200,{files:await workspace.listFiles(match[1])});return true;}
  match=matchRoute(path,/^\/api\/projects\/([^/]+)\/preview\/(.+)$/);
  if(match&&req.method==='GET'){const filePath=decodeURIComponent(match[2]),extension=extname(filePath).toLowerCase();let content=await workspace.read(match[1],filePath);if(extension==='.html'){const bridge=`<script>(()=>{const send=(level,args)=>parent.postMessage({source:'soren-preview',level,args:args.map(value=>{try{return typeof value==='string'?value:JSON.stringify(value)}catch{return String(value)}})},'*');for(const level of ['log','info','warn','error']){const original=console[level];console[level]=(...args)=>{send(level,args);original.apply(console,args)}};addEventListener('error',event=>send('error',[event.message]));})();<\/script>`;content=content.includes('<head>')?content.replace('<head>',`<head><base href="/api/projects/${match[1]}/preview/">${bridge}`):`<base href="/api/projects/${match[1]}/preview/">${bridge}${content}`;}const types:Record<string,string>={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.md':'text/markdown; charset=utf-8'};res.writeHead(200,{'Content-Type':types[extension]||'text/plain; charset=utf-8','Content-Security-Policy':"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'; frame-ancestors 'self'"});res.end(content);return true;}
  match=matchRoute(path,/^\/api\/projects\/([^/]+)\/file$/);
  if(match&&req.method==='GET'){const filePath=url.searchParams.get('path')||'';http.json(res,200,{path:filePath,content:await workspace.read(match[1],filePath)});return true;}
  if(match&&req.method==='PUT'){const input=await http.body(req),result=await workspace.write(match[1],String(input.path||''),String(input.content??''));db.touchProject(match[1]);http.json(res,200,{file:result});return true;}
  match=matchRoute(path,/^\/api\/projects\/([^/]+)\/commit$/);if(match&&req.method==='POST'){const input=await http.body(req);http.json(res,200,{commit:await workspace.commit(match[1],cleanName(input.message,'Save version'))});return true;}
  match=matchRoute(path,/^\/api\/projects\/([^/]+)\/history$/);if(match&&req.method==='GET'){http.json(res,200,{history:await workspace.history(match[1])});return true;}
  match=matchRoute(path,/^\/api\/projects\/([^/]+)\/diff$/);if(match&&req.method==='GET'){http.json(res,200,{diff:await workspace.diff(match[1],url.searchParams.get('commit')||undefined)});return true;}
  match=matchRoute(path,/^\/api\/projects\/([^/]+)\/restore$/);if(match&&req.method==='POST'){const input=await http.body(req);http.json(res,200,{commit:await workspace.restore(match[1],String(input.commit||''))});return true;}
  return false;
};}
