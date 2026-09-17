import { spawn } from 'node:child_process';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';

const dataRoot=await mkdtemp(join(tmpdir(),'soren-lifecycle-'));
const port='18787';
const runtimePort='18766';
const child=spawn(process.execPath,[resolve('apps/core/node_modules/tsx/dist/cli.mjs'),resolve('apps/core/src/server.ts')],{env:{...process.env,SOREN_DATA_ROOT:dataRoot,SOREN_PORT:port,CODEX_APP_SERVER_ENDPOINT:`ws://127.0.0.1:${runtimePort}`},stdio:['ignore','pipe','pipe']});
let stderr='';child.stderr.on('data',chunk=>stderr+=chunk);
try{
  let ready=false;
  for(let attempt=0;attempt<300;attempt++){await new Promise(resolveWait=>setTimeout(resolveWait,100));try{const response=await fetch(`http://127.0.0.1:${port}/api/health`);if(response.ok){ready=true;break;}}catch{}}
  if(!ready)throw new Error(`Core did not become ready: ${stderr}`);
  const health=await(await fetch(`http://127.0.0.1:${port}/api/health`)).json();
  if(health.personaVersion!=='v0.1'||health.services?.chatRuntime?.connected!==true||health.services?.chatRuntime?.endpoint!==`ws://127.0.0.1:${runtimePort}`)throw new Error(`Unexpected health: ${JSON.stringify(health)}`);
  for(const path of ['/api/home','/api/conversations','/api/projects','/api/moments','/api/cyberdaddy','/api/settings']){
    const response=await fetch(`http://127.0.0.1:${port}${path}`);
    if(!response.ok)throw new Error(`${path} returned ${response.status}: ${await response.text()}`);
  }
  const created=await fetch(`http://127.0.0.1:${port}/api/conversations`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Lifecycle smoke'})});
  if(created.status!==201)throw new Error(`conversation create returned ${created.status}: ${await created.text()}`);
  child.kill('SIGTERM');
  const exitCode=await Promise.race([new Promise(resolveExit=>child.once('exit',resolveExit)),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Core did not stop after SIGTERM')),5000))]);
  if(exitCode!==0&&exitCode!==null)throw new Error(`Core exited with ${exitCode}: ${stderr}`);
  let runtimeStopped=false;for(let attempt=0;attempt<30;attempt++){try{await fetch(`http://127.0.0.1:${runtimePort}/readyz`);}catch{runtimeStopped=true;break;}await new Promise(resolveWait=>setTimeout(resolveWait,100));}if(!runtimeStopped)throw new Error('Managed Chat runtime survived Core shutdown');
  console.log('Soren lifecycle smoke test passed.');
}finally{
  if(child.exitCode===null)child.kill();
  await rm(dataRoot,{recursive:true,force:true});
}
