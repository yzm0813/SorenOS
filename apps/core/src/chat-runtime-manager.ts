import { spawn as nodeSpawn,type ChildProcess } from 'node:child_process';

export type ChatRuntimeStatus={configured:boolean;connected:boolean;managed:boolean;endpoint:string;message:string};
type Options={endpoint?:string;command?:string;cwd?:string;env?:NodeJS.ProcessEnv;spawnImpl?:typeof nodeSpawn;probeImpl?:()=>Promise<boolean>;startupTimeoutMs?:number;pollMs?:number};

const loopback=new Set(['127.0.0.1','localhost','::1','[::1]']);
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
export function chatRuntimeUnavailable(error:unknown){const message=String((error as any)?.message||error||'');return /ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|WebSocket|socket|app-server|runtime/i.test(message);}
export function publicChatError(error:unknown){return chatRuntimeUnavailable(error)?{code:'chat_runtime_unavailable',message:'Chat runtime 暂时不可用，请稍后重试。',retryable:true}:{code:'chat_failed',message:'这次回复没有完成，请重试。',retryable:true};}

export class ChatRuntimeManager{
  readonly endpoint:string;private child:ChildProcess|null=null;private owned=false;private message='尚未检查';private starting:Promise<void>|null=null;
  private readonly command:string;private readonly cwd:string;private readonly env:NodeJS.ProcessEnv;private readonly spawnImpl:typeof nodeSpawn;private readonly probeImpl?:()=>Promise<boolean>;private readonly startupTimeoutMs:number;private readonly pollMs:number;
  constructor(options:Options={}){this.endpoint=options.endpoint||'ws://127.0.0.1:8765';const url=new URL(this.endpoint);if(url.protocol!=='ws:'||!loopback.has(url.hostname))throw new Error('Chat runtime 必须使用本机 ws://127.0.0.1 地址');this.command=options.command||process.env.SOREN_CODEX_COMMAND||'codex';this.cwd=options.cwd||process.cwd();this.env=options.env||process.env;this.spawnImpl=options.spawnImpl||nodeSpawn;this.probeImpl=options.probeImpl;this.startupTimeoutMs=options.startupTimeoutMs??15_000;this.pollMs=options.pollMs??150;}
  private healthUrl(){const url=new URL(this.endpoint);url.protocol='http:';url.pathname='/readyz';url.search='';return url.href;}
  async probe(){if(this.probeImpl)return this.probeImpl();try{const response=await fetch(this.healthUrl(),{signal:AbortSignal.timeout(1200)});return response.ok;}catch{return false;}}
  async status():Promise<ChatRuntimeStatus>{const connected=await this.probe();return{configured:true,connected,managed:this.owned,endpoint:this.endpoint,message:connected?'Ready':this.message};}
  async start(){if(this.starting)return this.starting;this.starting=this.startInner().finally(()=>{this.starting=null;});return this.starting;}
  private async startInner(){if(await this.probe()){this.message='使用已有 Codex app-server';return;}this.message='正在启动 Codex app-server';const child=this.spawnImpl(this.command,['app-server','--listen',this.endpoint],{cwd:this.cwd,env:{...this.env},windowsHide:true,stdio:['ignore','pipe','pipe']});this.child=child;this.owned=true;const capture=(chunk:any)=>{const line=String(chunk||'').trim().split(/\r?\n/).at(-1);if(line)this.message=line.slice(0,240);};child.stdout?.on('data',capture);child.stderr?.on('data',capture);child.on('error',error=>{this.message=String(error.message||'Codex app-server 启动失败').slice(0,240);});child.on('exit',()=>{if(this.child===child){this.child=null;this.owned=false;if(this.message==='Ready')this.message='Codex app-server 已停止';}});const deadline=Date.now()+this.startupTimeoutMs;while(Date.now()<deadline){if(child.exitCode!==null)break;if(await this.probe()){this.message='Ready';return;}await sleep(this.pollMs);}await this.stop();throw new Error(`Chat runtime 启动失败：${this.message}`);}
  async stop(){const child=this.child;if(!child||!this.owned)return;this.child=null;this.owned=false;if(child.exitCode!==null)return;child.kill('SIGTERM');await Promise.race([new Promise<void>(resolve=>child.once('exit',()=>resolve())),sleep(3000)]);if(child.exitCode===null)child.kill('SIGKILL');}
}
