import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { PersonaService } from './persona-service.js';
import { buildTurnContext } from './context.js';
import { buildSocialPrompt,type SocialGenerationRequest } from './social-generator.js';
import { socialActors } from './social-actors.js';
import { CodexCyberDaddyEvaluator } from './cyberdaddy-evaluator.js';
import { buildHomeNotePrompt } from './scene-prompts.js';
import { SorenDatabase } from './db.js';
import { SelfStateService } from './self-state-service.js';
import { MomentsService } from './moments-service.js';
import { SocialLifeEngine } from './social-life.js';

const personaRoot=fileURLToPath(new URL('../../../persona/',import.meta.url));
const persona=new PersonaService(personaRoot);
const message={id:'m',conversationId:'chat',role:'user' as const,content:'继续项目',quotedMessageId:null,createdAt:'2026-09-17T00:00:00.000Z'};

test('Chat, new Chat, project Chat and model switches load one Soren Core',async()=>{await persona.init();const identity=await persona.identity();assert.equal(identity.version,'v0.1');assert.match(identity.content,/SorenOS 中唯一且连续存在的 Soren/);const contexts=['new-chat','gpt-5.6','gpt-6-astra'].map(()=>buildTurnContext({identity:identity.content,retrievedMemory:'',recentMessages:[message]})),project=buildTurnContext({identity:identity.content,retrievedMemory:'',recentMessages:[message],projectName:'SorenOS'});for(const context of [...contexts,project]){assert.match(context,/Soren Core v0\.1/);assert.equal((context.match(/SorenOS 中唯一且连续存在的 Soren/g)||[]).length,1);}});

test('CyberDaddy future evaluator and Home Note prompt use the same identity source',async()=>{let cyberPrompt='';const evaluator=new CodexCyberDaddyEvaluator(persona,async(_input,prompt)=>{cyberPrompt=prompt;return{action:'NO_ACTION',message:'',reason:'test',nextEligibleFollowUpAt:null};});await evaluator.evaluate({now:new Date('2026-09-17T10:00:00Z'),recentUserContext:'',domain:{id:'study',name:'学习',enabled:true,intensity:'normal',settings:{},createdAt:'',updatedAt:''},commitment:{id:'c',domainId:'study',description:'复习',status:'active',targetAt:null,createdAt:'',updatedAt:'',completedAt:null,sourceConversationId:null,recurrence:'none',recurrenceTime:null,cycleKey:null,cycleFollowUpCount:0,lastFollowUpAt:null,nextFollowUpAt:null,followUpCount:0,metadata:{}}});const homePrompt=await buildHomeNotePrompt(persona);for(const prompt of [cyberPrompt,homePrompt]){assert.match(prompt,/Soren Core v0\.1/);assert.match(prompt,/SorenOS 中唯一且连续存在的 Soren/);}});

test('Moments Soren generation uses Core while a non-Soren actor keeps independent persona',async()=>{const actor=(id:string)=>socialActors.find(item=>item.id===id)!;const request=(id:string):SocialGenerationRequest=>({now:'2026-09-17T10:00:00Z',actor:actor(id),actors:socialActors,state:{actorId:id,mood:'平静',energy:60,focus:'',currentActivity:'',lastPostAt:null,lastInteractionAt:null,updatedAt:''},events:[],recentChats:[],recentPosts:[],recentActivity:[]});const soren=await buildSocialPrompt(request('soren'),persona),kevin=await buildSocialPrompt(request('kevin'),persona);assert.match(soren,/Soren Core v0\.1/);assert.match(soren,/SorenOS 中唯一且连续存在的 Soren/);assert.doesNotMatch(soren,/Soren 冷、简洁、有判断、会嘴欠/);assert.match(kevin,/嘴欠、爱起哄的损友/);assert.doesNotMatch(kevin,/Soren Core v0\.1/);});

test('SocialLife routes the Soren actor with persisted Self State',async()=>{const directory=mkdtempSync(join(tmpdir(),'soren-social-identity-')),db=new SorenDatabase(join(directory,'soren.db')),state=new SelfStateService(db),moments=new MomentsService(db),captured:{request:SocialGenerationRequest|null}={request:null};const engine=new SocialLifeEngine(db,moments,{generate:async input=>{captured.request=input;return{action:'none',reason:'保持安静'};}},state);try{state.update({currentInterests:['identity systems']});moments.social.addEvent({type:'reflection',actorId:'soren',summary:'正在整理身份架构',importance:9,dueAt:new Date(Date.now()-1000).toISOString()});await engine.pulse(true);assert.equal(captured.request?.actor.id,'soren');assert.deepEqual(captured.request?.selfState?.currentInterests,['identity systems']);const prompt=await buildSocialPrompt(captured.request!,persona);assert.match(prompt,/Soren Core v0\.1/);}finally{engine.stop();db.close();rmSync(directory,{recursive:true,force:true});}});

test('Self State persists independently from user memory and conversations',()=>{const directory=mkdtempSync(join(tmpdir(),'soren-self-state-')),file=join(directory,'soren.db');try{const firstDb=new SorenDatabase(file),first=new SelfStateService(firstDb),updated=first.update({currentInterests:['distributed systems'],digitalLifeState:'在整理自己的长期线索',socialRelationships:{kevin:'最近在互相吐槽 bug'}});firstDb.createConversation('新的聊天');assert.equal(firstDb.memories('',true).length,0);firstDb.close();const secondDb=new SorenDatabase(file),second=new SelfStateService(secondDb);assert.deepEqual(second.get().currentInterests,['distributed systems']);assert.equal(second.get().digitalLifeState,updated.digitalLifeState);assert.equal(secondDb.conversations().length,1);assert.equal(secondDb.memories('',true).length,0);secondDb.close();}finally{rmSync(directory,{recursive:true,force:true});}});

test('disabled SocialLife does not mutate Self State through autonomous events',async()=>{const directory=mkdtempSync(join(tmpdir(),'soren-self-disabled-')),db=new SorenDatabase(join(directory,'soren.db')),state=new SelfStateService(db),moments=new MomentsService(db),before=state.update({recentReflections:['保留这条状态']}),generator={generate:async()=>{throw new Error('disabled generator must not run');}},engine=new SocialLifeEngine(db,moments,generator,state);try{db.setSetting('momentsLifeEnabled',false);engine.recordEvent({type:'chat_turn',summary:'不应写入'});await engine.pulse(true);assert.deepEqual(state.get(),before);}finally{engine.stop();db.close();rmSync(directory,{recursive:true,force:true});}});
