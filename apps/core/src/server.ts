import http from 'node:http';
import { mkdir } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { CodexRuntime } from '@soren/runtime-codex';
import { WorkspaceService } from '@soren/workspace';
import { OmbreMemory } from '@soren/memory';
import { SorenDatabase } from './db.js';
import { OpenMeteoWeatherProvider } from './weather.js';
import { MemoryService } from './memory-service.js';
import { MomentsService } from './moments-service.js';
import { CodexSocialGenerator } from './social-generator.js';
import { SocialLifeEngine } from './social-life.js';
import { EventService } from './event-service.js';
import { CyberDaddyService } from './cyberdaddy-service.js';
import { PersonaService } from './persona-service.js';
import { SelfStateService } from './self-state-service.js';
import { ConversationTurnService } from './conversation-turn-service.js';
import { createHttpTools,type RouteHandler } from './http/index.js';
import { createStaticHandler } from './static-handler.js';
import { createHomeRoutes } from './routes/home.js';
import { createConversationRoutes } from './routes/conversations.js';
import { createWorkspaceRoutes } from './routes/workspace.js';
import { createMemoryRoutes } from './routes/memory.js';
import { createMomentsRoutes } from './routes/moments.js';
import { createCyberDaddyRoutes } from './routes/cyberdaddy.js';
import { createNotificationRoutes } from './routes/notifications.js';
import { createSettingsRoutes } from './routes/settings.js';
import { createMcpRoutes } from './routes/mcp.js';

const appRoot=fileURLToPath(new URL('../../../',import.meta.url));
const dataRoot=resolve(process.env.SOREN_DATA_ROOT||resolve(appRoot,'..','data'));
const workspaceRoot=join(dataRoot,'workspace'),personaRoot=join(appRoot,'persona'),attachmentRoot=join(dataRoot,'attachments'),logRoot=join(dataRoot,'logs'),momentsRuntimeRoot=join(dataRoot,'moments-runtime'),webDist=join(appRoot,'dist');
await Promise.all([dataRoot,workspaceRoot,attachmentRoot,logRoot,momentsRuntimeRoot].map(path=>mkdir(path,{recursive:true})));

const db=new SorenDatabase(join(dataRoot,'soren.db'));
const homeNote=db.ensureHomeNote('我在这里。今天想说话，或者想一起做点什么，都可以来找我。');
const workspace=new WorkspaceService(workspaceRoot);await workspace.init();
const persona=new PersonaService(personaRoot);await persona.init();const identity=await persona.identity();
const ombre=new OmbreMemory(process.env.OMBRE_MCP_ENDPOINT||'http://127.0.0.1:18001/mcp');
const memory=new MemoryService(ombre,db),selfState=new SelfStateService(db),events=new EventService(db),cyberDaddy=new CyberDaddyService(db,events);
const moments=new MomentsService(db,post=>events.emit({type:'moment.created',sourceType:'moment',sourceId:post.id,title:`${post.actor.nickname} 的朋友圈`,body:post.content||post.imageDescription,payload:{authorId:post.authorId}}));
const codex=new CodexRuntime(process.env.CODEX_APP_SERVER_ENDPOINT||'ws://127.0.0.1:8765');
const socialLife=new SocialLifeEngine(db,moments,new CodexSocialGenerator(codex,db,momentsRuntimeRoot,persona),selfState);
const require=createRequire(import.meta.url),{CyberbossAdapter}=require(join(appRoot,'soren-core','cyberboss-adapter.cjs')) as {CyberbossAdapter:new(options:any)=>any};
const cyberboss=new CyberbossAdapter({stateDir:join(dataRoot,'cyberboss')});
const host=process.env.SOREN_HOST||'127.0.0.1',port=Number(process.env.SOREN_PORT||8787),httpTools=createHttpTools(process.env.SOREN_WEB_ORIGIN||'http://127.0.0.1:5173');
const turns=new ConversationTurnService({db,memory,workspace,codex,socialLife,moments,persona,selfState,workspaceRoot,attachmentRoot,http:httpTools});
const weatherProvider=new OpenMeteoWeatherProvider();
const routes:RouteHandler[]=[
  createHomeRoutes({db,events,moments,cyberboss,weatherProvider,memory,codex,homeNote,persona,http:httpTools}),
  createConversationRoutes({db,turns,http:httpTools}),createWorkspaceRoutes({db,workspace,http:httpTools}),createMemoryRoutes({memory,http:httpTools}),
  createMomentsRoutes({moments,socialLife,db,http:httpTools}),createCyberDaddyRoutes({service:cyberDaddy,http:httpTools}),
  createNotificationRoutes({db,events,http:httpTools}),createSettingsRoutes({db,persona,selfState,http:httpTools}),createMcpRoutes({ombre,memory,db,http:httpTools})
];
const serveStatic=createStaticHandler(webDist,httpTools);

const server=http.createServer(async(req,res)=>{if(req.method==='OPTIONS'){res.writeHead(204,httpTools.cors());res.end();return;}const url=new URL(req.url||'/',`http://${req.headers.host}`),context={req,res,url,path:url.pathname};try{for(const route of routes)if(await route(context))return;if(url.pathname.startsWith('/api/'))return httpTools.json(res,404,{message:'Unknown API route'});await serveStatic(req,res);}catch(error:any){const message=error?.message||'Soren Core error',status=/拒绝|无效文件路径/.test(message)?403:/不存在|不能为空|无效|必须/.test(message)?400:500;httpTools.json(res,status,{message});}});

socialLife.start();cyberDaddy.start();
const reminderTimer=setInterval(()=>{for(const reminder of cyberboss.pollDue()){events.emit({type:reminder.important?'reminder.important':'reminder.due',sourceType:'reminder',sourceId:String(reminder.id),title:reminder.important?'重要提醒':'提醒',body:String(reminder.text||''),dedupeKey:`reminder:due:${reminder.id}`,payload:{dueAt:reminder.dueAt,important:Boolean(reminder.important)}});}},5000);reminderTimer.unref();

let cleanupPromise:Promise<void>|null=null;
function cleanup(){return cleanupPromise??=(async()=>{clearInterval(reminderTimer);cyberDaddy.stop();socialLife.stop();await codex.dispose().catch(()=>undefined);db.close();})();}
server.on('close',()=>{void cleanup();});
async function shutdown(){clearInterval(reminderTimer);cyberDaddy.stop();socialLife.stop();if(server.listening)await new Promise<void>(resolveClose=>server.close(()=>resolveClose()));await cleanup();}
process.once('SIGINT',()=>{void shutdown();});process.once('SIGTERM',()=>{void shutdown();});
server.listen(port,host,()=>console.log(`Soren Core v2 (${identity.version}) running at http://${host}:${port}`));
