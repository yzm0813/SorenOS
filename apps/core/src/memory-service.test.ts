import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { OmbreMemory } from '@soren/memory';
import { SorenDatabase } from './db.js';
import { MemoryService } from './memory-service.js';

function setup(remote:Partial<OmbreMemory>={}){const directory=mkdtempSync(join(tmpdir(),'soren-memory-')),store=new SorenDatabase(join(directory,'soren.db'));const offline={client:{health:async()=>({configured:true,connected:false})},breath:async()=>{throw new Error('offline')},search:async()=>{throw new Error('offline')},hold:async()=>{throw new Error('offline')},trace:async()=>{throw new Error('offline')},...remote} as unknown as OmbreMemory;return{directory,store,memory:new MemoryService(offline,store)};}

test('recalls a durable fact across conversations while Ombre is offline',async()=>{const{directory,store,memory}=setup();try{await memory.remember({content:'用户喜欢蓝色和海边。',title:'颜色偏好',scope:'long_term',importance:7,sourceType:'chat',sourceId:'chat-a'});const recalled=await memory.recall({message:'你记得我喜欢什么颜色吗？',conversationId:'chat-b',projectId:null});assert.equal(recalled.degraded,true);assert.match(recalled.content,/喜欢蓝色/);assert.equal(store.memory('missing'),null);}finally{store.db.close();rmSync(directory,{recursive:true,force:true});}});

test('Memory Seed import is idempotent by normalized content',async()=>{const{directory,store,memory}=setup();try{const seed=JSON.stringify({memories:[{title:'称呼',content:'用户喜欢被称作宝宝。',scope:'core',importance:9,pinned:true}]});const first=await memory.importSeed(seed),second=await memory.importSeed(seed);assert.equal(first.imported,1);assert.equal(second.imported,0);assert.equal(second.updated,1);assert.equal(memory.list().length,1);assert.equal(memory.list()[0].pinned,true);}finally{store.db.close();rmSync(directory,{recursive:true,force:true});}});

test('tracks the Ombre bucket and skips an already synced duplicate',async()=>{let held='',holdCalls=0;const{directory,store,memory}=setup({hold:async(content:string)=>{held=content;holdCalls++;return'新建→bucket_phase2 长期记忆';}});try{const item={content:'跨会话在线记忆',scope:'long_term' as const,sourceType:'chat' as const,sourceId:'chat-a'};const result=await memory.remember(item);await memory.remember(item);assert.equal(held,'跨会话在线记忆');assert.equal(holdCalls,1);assert.equal(result.degraded,false);assert.equal(result.record.syncStatus,'synced');assert.equal(result.record.remoteId,'bucket_phase2');}finally{store.db.close();rmSync(directory,{recursive:true,force:true});}});
