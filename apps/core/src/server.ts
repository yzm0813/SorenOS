import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { CodexRuntime } from '@soren/runtime-codex';
import { WorkspaceService, slugifyProject } from '@soren/workspace';
import { OmbreMemory } from '@soren/memory';
import { McpHttpClient } from '@soren/mcp-client';
import type { ThinkingDepth, ThinkingMode, ToolPermission, TurnEvent } from '@soren/shared';
import { SorenDatabase } from './db.js';

const appRoot = fileURLToPath(new URL('../../../', import.meta.url));
const dataRoot = resolve(appRoot, '..', 'data');
const workspaceRoot = join(dataRoot, 'workspace');
const personaRoot = join(dataRoot, 'persona');
const attachmentRoot = join(dataRoot, 'attachments');
const logRoot = join(dataRoot, 'logs');
const webDist = join(appRoot, 'apps', 'web', 'dist');
await Promise.all([mkdir(dataRoot,{recursive:true}),mkdir(workspaceRoot,{recursive:true}),mkdir(personaRoot,{recursive:true}),mkdir(attachmentRoot,{recursive:true}),mkdir(logRoot,{recursive:true})]);

const db = new SorenDatabase(join(dataRoot, 'soren.db'));
const workspace = new WorkspaceService(workspaceRoot);
await workspace.init();
const memory = new OmbreMemory(process.env.OMBRE_MCP_ENDPOINT || 'http://127.0.0.1:18001/mcp');
const codex = new CodexRuntime(process.env.CODEX_APP_SERVER_ENDPOINT || 'ws://127.0.0.1:8765');
const require = createRequire(import.meta.url);
const { CyberbossAdapter } = require(join(appRoot, 'soren-core', 'cyberboss-adapter.cjs')) as { CyberbossAdapter: new (options: any) => any };
const cyberboss = new CyberbossAdapter({ stateDir: join(dataRoot, 'cyberboss') });
const host = process.env.SOREN_HOST || '127.0.0.1';
const port = Number(process.env.SOREN_PORT || 8787);
const allowedOrigin = process.env.SOREN_WEB_ORIGIN || 'http://127.0.0.1:5173';
const activeTurns = new Map<string, { threadId: string; codexTurnId: string }>();
const personaDefaults: Record<string,string> = {
  'core.md': '# Core\n\n你是 Soren，运行在用户自己的私人聊天软件中，是长期、可靠、自然的私人伴侣。',
  'language-style.md': '# Language style\n\n直接、清楚、自然；根据用户的语言和语气回应，不堆砌套话。',
  'boundaries.md': '# Boundaries\n\n保护隐私，不展示内部推理；只在用户明确授权时执行高风险操作。',
  'work-mode.md': '# Work mode\n\n处理工作时先给结论，主动完成可逆步骤，清楚说明结果与验证。',
  'novel-mode.md': '# Novel mode\n\n讨论创作时尊重既有人物、语气和世界观，指出逻辑问题并给出可落地修法。'
};
for (const [name, content] of Object.entries(personaDefaults)) {
  const path = join(personaRoot, name);
  try { await stat(path); } catch { await writeFile(path, content, 'utf8'); }
}

const cors = () => ({ 'Access-Control-Allow-Origin': allowedOrigin, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS' });
function json(res: ServerResponse, status: number, body: unknown) { res.writeHead(status,{...cors(),'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(body)); }
async function body(req: IncomingMessage, limit = 12_000_000) { let raw=''; for await (const chunk of req) { raw += chunk; if (raw.length > limit) throw new Error('请求内容过大'); } return raw ? JSON.parse(raw) : {}; }
function sse(res: ServerResponse) { res.writeHead(200,{...cors(),'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive'}); res.write(': connected\n\n'); return (event:TurnEvent) => res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`); }
function route(pathname:string, pattern:RegExp) { return pathname.match(pattern); }
function cleanName(value:unknown, fallback='未命名') { return String(value || '').trim().slice(0,80) || fallback; }
function validThinking(value:unknown): ThinkingMode { return value === 'off' || value === 'always' ? value : 'auto'; }
function validDepth(value:unknown): ThinkingDepth { return value === 'deep' ? 'deep' : 'quick'; }
function wantsPast(text:string) { return /(之前|上次|过去|还记得|曾经|以前|last time|remember when|previous)/i.test(text); }
function wantsHold(text:string) { return /(记住|帮我记下|记一下|以后要记得|remember this|save this to memory)/i.test(text); }
function complexTask(text:string) { return text.length > 500 || /(分析|架构|调试|debug|重构|长文|方案|比较|为什么|review|implement)/i.test(text); }
async function personaText() { return (await Promise.all(Object.keys(personaDefaults).map(async name => readFile(join(personaRoot,name),'utf8')))).join('\n\n'); }
async function probe(url:string) { try { const response=await fetch(url,{signal:AbortSignal.timeout(1500)}); return {configured:true,connected:response.ok}; } catch { return {configured:true,connected:false}; } }
async function saveAttachments(items:any[], messageId:string) {
  const saved:Array<{name:string;absolutePath:string;mime:string}> = [];
  const dir=join(attachmentRoot,messageId); await mkdir(dir,{recursive:true});
  for (const item of items.slice(0,8)) {
    const name=cleanName(item.name,'attachment').replace(/[<>:"/\\|?*]/g,'_');
    const bytes=Buffer.from(String(item.base64||''),'base64');
    if (!bytes.length || bytes.length>8_000_000) continue;
    const path=join(dir,`${crypto.randomUUID().slice(0,8)}-${name}`); await writeFile(path,bytes);
    db.addAttachment(messageId,{name,path,mime:String(item.mime||'application/octet-stream'),size:bytes.length});
    saved.push({name,absolutePath:path,mime:String(item.mime||'application/octet-stream')});
  }
  return saved;
}
function conversationRow(row:any) { return { id:row.id,name:row.name,directory:row.directory,type:row.type,previewEntry:row.preview_entry,createdAt:row.created_at,updatedAt:row.updated_at }; }

async function serveStatic(req:IncomingMessage,res:ServerResponse) {
  const url=new URL(req.url||'/',`http://${req.headers.host}`); const requestPath=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
  const target=normalize(join(webDist,requestPath)); if (!target.startsWith(normalize(webDist))) return json(res,403,{message:'Forbidden'});
  try { const info=await stat(target); const file=info.isDirectory()?join(target,'index.html'):target; const content=await readFile(file); const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'}; res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(content); } catch { json(res,404,{message:'Not found'}); }
}

const server=http.createServer(async(req,res)=>{
  if(req.method==='OPTIONS'){res.writeHead(204,cors());return res.end();}
  const url=new URL(req.url||'/',`http://${req.headers.host}`); const path=url.pathname;
  try {
    if(req.method==='GET'&&path==='/api/health') return json(res,200,{ok:true,name:'soren-core',version:2});
    if(req.method==='GET'&&path==='/api/bootstrap') return json(res,200,{core:{connected:true,version:2},services:{codex:await probe('http://127.0.0.1:8765/readyz'),ombre:await memory.client.health(),cyberboss:{configured:true,connected:true,mode:'soren-channel'}}});
    if(req.method==='GET'&&path==='/api/models') return json(res,200,{models:await codex.models()});
    if(req.method==='GET'&&path==='/api/reminders')return json(res,200,{reminders:cyberboss.listReminders()});
    if(req.method==='POST'&&path==='/api/reminders'){const input=await body(req);return json(res,201,{reminder:cyberboss.createReminder(input)});}
    if(req.method==='GET'&&path==='/api/inbox')return json(res,200,{messages:cyberboss.listInbox()});
    if(req.method==='GET'&&path==='/api/timeline')return json(res,200,{events:cyberboss.listTimeline()});

    if(req.method==='GET'&&path==='/api/conversations') return json(res,200,{conversations:db.conversations(url.searchParams.get('q')||'',url.searchParams.get('archived')==='1')});
    if(req.method==='POST'&&path==='/api/conversations') { const input=await body(req); const context=await memory.breath().catch(()=> ''); return json(res,201,{conversation:db.createConversation(cleanName(input.title,'新对话'),context)}); }
    let match=route(path,/^\/api\/conversations\/([^/]+)$/);
    if(match&&req.method==='GET'){const conversation=db.conversationById(match[1]);if(!conversation)return json(res,404,{message:'会话不存在'});return json(res,200,{conversation,messages:db.messages(match[1])});}
    if(match&&req.method==='PATCH'){const input=await body(req);return json(res,200,{conversation:db.updateConversation(match[1],input)});}

    match=route(path,/^\/api\/conversations\/([^/]+)\/turns$/);
    if(match&&req.method==='POST') {
      const conversationId=match[1],input=await body(req),conversation=db.conversationById(conversationId);
      if(!conversation)return json(res,404,{message:'会话不存在'});
      const message=String(input.message||'').trim();if(!message)return json(res,400,{message:'消息不能为空'});
      if(input.editMessageId){db.updateMessage(input.editMessageId,message);db.deleteMessagesAfter(conversationId,input.editMessageId);} 
      const userMessage=input.editMessageId?db.messages(conversationId).find(item=>item.id===input.editMessageId)!:db.addMessage(conversationId,'user',message,input.quotedMessageId||null);
      if(conversation.title==='新对话')db.updateConversation(conversationId,{title:message.slice(0,28)});
      const attachments=await saveAttachments(Array.isArray(input.attachments)?input.attachments:[],userMessage.id);
      const turnId=crypto.randomUUID();const model=String(input.model||conversation.defaultModel||'');db.createTurn(turnId,conversationId,model);
      const send=sse(res);const mode=validThinking(input.thinkingMode||conversation.thinkingMode),depth=validDepth(input.thinkingDepth||conversation.thinkingDepth);
      if(mode==='always'||(mode==='auto'&&complexTask(message)))send({type:'thinking.summary',conversationId,turnId,text:complexTask(message)?'我会先梳理目标和约束，再检查结果是否可用。':'我会快速整理关键信息后回答。'});
      try {
        let memoryContext=conversation.memoryContext;
        if(wantsPast(message))memoryContext=await memory.search(message).catch(()=>memoryContext);
        if(wantsHold(message)){await memory.hold(message,{title:message.slice(0,40),domain:'用户明确记忆',importance:7}).catch(()=>{});}
        const project=conversation.projectId?db.project(conversation.projectId):null;
        const cwd=project?workspace.projectDir(project.id):workspaceRoot;
        let threadId=conversation.codexThreadId;
        if(!threadId){threadId=await codex.createThread(cwd,model);db.updateConversation(conversationId,{codexThreadId:threadId});}
        const before=project?await workspace.changedPaths(project.id):[];
        const textAttachments=await Promise.all(attachments.filter(a=>a.mime.startsWith('text/')||/\.(md|txt|json|csv)$/i.test(a.name)).map(async a=>`附件 ${a.name}：\n${(await readFile(a.absolutePath,'utf8')).slice(0,200000)}`));
        const context=[await personaText(),memoryContext?`Ombre Brain 相关记忆：\n${memoryContext}`:'',project?`当前 Workspace 项目：${project.name}。只在该项目目录内操作文件。`:'',...textAttachments].filter(Boolean).join('\n\n');
        let reply='';
        const result=await codex.run({threadId,text:`${context}\n\n用户消息：${message}`,model,effort:depth==='deep'?'high':'low',cwd,attachments:attachments.filter(a=>a.mime.startsWith('image/')).map(a=>({absolutePath:a.absolutePath})),onTurnStarted:(codexTurnId)=>activeTurns.set(turnId,{threadId,codexTurnId}),onEvent:event=>{
          if(event.type==='delta'){reply+=event.text;send({type:'assistant.delta',conversationId,turnId,text:event.text});}
          if(event.type==='tool-started'||event.type==='tool-completed')send({type:event.type==='tool-started'?'tool.started':'tool.completed',conversationId,turnId,tool:event.tool});
        }});
        const assistant=db.addMessage(conversationId,'assistant',reply||result.text);db.finishTurn(turnId,'completed',result.turnId);
        if(project){const after=await workspace.changedPaths(project.id);const changed=[...new Set([...before,...after])];if(changed.length){await workspace.commit(project.id,`Soren: ${message.slice(0,72)}`);db.touchProject(project.id);send({type:'file.changed',conversationId,turnId,projectId:project.id,paths:changed});}}
        send({type:'turn.completed',conversationId,turnId,messageId:assistant.id});res.end();
      } catch(error:any){db.finishTurn(turnId,'error');send({type:'turn.error',conversationId,turnId,message:error?.message||'Soren Runtime 出错'});res.end();} finally{activeTurns.delete(turnId);}
      return;
    }
    match=route(path,/^\/api\/conversations\/([^/]+)\/turns\/([^/]+)\/cancel$/);
    if(match&&req.method==='POST'){const active=activeTurns.get(match[2]);if(!active)return json(res,404,{message:'这一轮已经结束'});await codex.cancel(active.threadId,active.codexTurnId);db.finishTurn(match[2],'cancelled',active.codexTurnId);return json(res,200,{cancelled:true});}

    if(req.method==='GET'&&path==='/api/projects'){const projects=await Promise.all(db.projectRows().map(async row=>({...conversationRow(row),gitStatus:(await workspace.changedPaths(row.id)).length?'changed':'clean'})));return json(res,200,{projects});}
    if(req.method==='POST'&&path==='/api/projects'){const input=await body(req),name=cleanName(input.name,'新项目'),type=['web','markdown','files'].includes(input.type)?input.type:'files',id=slugifyProject(name),at=new Date().toISOString();await workspace.createProject(id,name,type);const project={id,name,directory:id,type,previewEntry:type==='web'?'index.html':type==='markdown'?'README.md':null,createdAt:at,updatedAt:at};db.addProject(project as any);return json(res,201,{project:{...project,gitStatus:'clean'}});}
    match=route(path,/^\/api\/projects\/([^/]+)$/);if(match&&req.method==='GET'){const project=db.project(match[1]);if(!project)return json(res,404,{message:'项目不存在'});return json(res,200,{project:conversationRow(project),files:await workspace.listFiles(match[1])});}
    match=route(path,/^\/api\/projects\/([^/]+)\/files$/);if(match&&req.method==='GET'){return json(res,200,{files:await workspace.listFiles(match[1])});}
    match=route(path,/^\/api\/projects\/([^/]+)\/preview\/(.+)$/);
    if(match&&req.method==='GET'){
      const filePath=decodeURIComponent(match[2]);let content=await workspace.read(match[1],filePath);const extension=extname(filePath).toLowerCase();
      if(extension==='.html'){
        const bridge=`<script>(()=>{const send=(level,args)=>parent.postMessage({source:'soren-preview',level,args:args.map(value=>{try{return typeof value==='string'?value:JSON.stringify(value)}catch{return String(value)}})},'*');for(const level of ['log','info','warn','error']){const original=console[level];console[level]=(...args)=>{send(level,args);original.apply(console,args)}};addEventListener('error',event=>send('error',[event.message]));})();<\/script>`;
        content=content.includes('<head>')?content.replace('<head>',`<head><base href="/api/projects/${match[1]}/preview/">${bridge}`):`<base href="/api/projects/${match[1]}/preview/">${bridge}${content}`;
      }
      const types:Record<string,string>={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.md':'text/markdown; charset=utf-8'};
      res.writeHead(200,{'Content-Type':types[extension]||'text/plain; charset=utf-8','Content-Security-Policy':"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'; frame-ancestors 'self'"});return res.end(content);
    }
    match=route(path,/^\/api\/projects\/([^/]+)\/file$/);
    if(match&&req.method==='GET'){const filePath=url.searchParams.get('path')||'';return json(res,200,{path:filePath,content:await workspace.read(match[1],filePath)});}
    if(match&&req.method==='PUT'){const input=await body(req);const result=await workspace.write(match[1],String(input.path||''),String(input.content??''));db.touchProject(match[1]);return json(res,200,{file:result});}
    match=route(path,/^\/api\/projects\/([^/]+)\/commit$/);if(match&&req.method==='POST'){const input=await body(req);return json(res,200,{commit:await workspace.commit(match[1],cleanName(input.message,'Save version'))});}
    match=route(path,/^\/api\/projects\/([^/]+)\/history$/);if(match&&req.method==='GET')return json(res,200,{history:await workspace.history(match[1])});
    match=route(path,/^\/api\/projects\/([^/]+)\/diff$/);if(match&&req.method==='GET')return json(res,200,{diff:await workspace.diff(match[1],url.searchParams.get('commit')||undefined)});
    match=route(path,/^\/api\/projects\/([^/]+)\/restore$/);if(match&&req.method==='POST'){const input=await body(req);return json(res,200,{commit:await workspace.restore(match[1],String(input.commit||''))});}

    if(req.method==='POST'&&path==='/api/memory/breath')return json(res,200,{content:await memory.breath()});
    if(req.method==='POST'&&path==='/api/memory/search'){const input=await body(req);return json(res,200,{content:await memory.search(String(input.query||''))});}
    if(req.method==='POST'&&path==='/api/memory/hold'){const input=await body(req);return json(res,200,{content:await memory.hold(String(input.content||''),input)});}
    if(req.method==='GET'&&path==='/api/mcp'){const tools:any=await memory.tools().catch(()=>({tools:[]}));return json(res,200,{servers:[{id:'ombre',name:'Ombre Brain',status:await memory.client.health(),tools:tools?.tools||tools?.result?.tools||[]}],permissions:db.permissions(),audit:db.audits()});}
    if(req.method==='PUT'&&path==='/api/mcp/permissions'){const input=await body(req);const item=input as ToolPermission;if(!['always_allow','ask_each_time','disabled'].includes(item.permission))return json(res,400,{message:'无效权限'});db.setPermission(item);db.audit(item.server,item.tool,'permission_changed',item.permission);return json(res,200,{permission:item});}
    if(req.method==='GET'&&path==='/api/settings')return json(res,200,{settings:db.settings(),persona:Object.fromEntries(await Promise.all(Object.keys(personaDefaults).map(async name=>[name,await readFile(join(personaRoot,name),'utf8')])))});
    if(req.method==='PUT'&&path==='/api/settings'){const input=await body(req);for(const [key,value]of Object.entries(input.settings||{}))db.setSetting(key,value);for(const [name,content]of Object.entries(input.persona||{})){if(!(name in personaDefaults))continue;await writeFile(join(personaRoot,name),String(content),'utf8');}return json(res,200,{saved:true});}
    if(path.startsWith('/api/'))return json(res,404,{message:'Unknown API route'});
    return serveStatic(req,res);
  } catch(error:any){const message=error?.message||'Soren Core error';const status=/拒绝|无效文件路径/.test(message)?403:/不存在|不能为空/.test(message)?400:500;return json(res,status,{message});}
});
setInterval(()=>cyberboss.pollDue(),5000).unref();
server.listen(port,host,()=>console.log(`Soren Core v2 running at http://${host}:${port}`));
