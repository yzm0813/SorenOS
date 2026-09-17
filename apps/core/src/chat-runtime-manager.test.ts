import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { ChatRuntimeManager,publicChatError } from './chat-runtime-manager.js';

function fakeChild(){const child:any=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.exitCode=null;child.kill=(signal:string)=>{child.exitCode=signal==='SIGTERM'?0:1;queueMicrotask(()=>child.emit('exit',child.exitCode));return true;};return child;}
test('reuses an existing localhost runtime without owning it',async()=>{let spawned=false;const manager=new ChatRuntimeManager({probeImpl:async()=>true,spawnImpl:(()=>{spawned=true;return fakeChild();}) as any});await manager.start();assert.equal(spawned,false);assert.deepEqual(await manager.status(),{configured:true,connected:true,managed:false,endpoint:'ws://127.0.0.1:8765',message:'Ready'});});
test('starts and stops one localhost Codex app-server when unavailable',async()=>{let probes=0,args:string[]=[];const child=fakeChild(),manager=new ChatRuntimeManager({probeImpl:async()=>++probes>1,spawnImpl:((_command:any,value:any)=>{args=value;return child;}) as any,startupTimeoutMs:100,pollMs:1});await manager.start();assert.deepEqual(args,['app-server','--listen','ws://127.0.0.1:8765']);assert.equal((await manager.status()).managed,true);await manager.stop();assert.equal(child.exitCode,0);});
test('rejects LAN binding and hides transport errors from Chat',()=>{assert.throws(()=>new ChatRuntimeManager({endpoint:'ws://0.0.0.0:8765'}),/本机/);assert.deepEqual(publicChatError(new Error('connect ECONNREFUSED 127.0.0.1:8765')),{code:'chat_runtime_unavailable',message:'Chat runtime 暂时不可用，请稍后重试。',retryable:true});});
