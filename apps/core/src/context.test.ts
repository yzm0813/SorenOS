import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTurnContext,buildTurnPrompt,TURN_CONTEXT_LIMIT,TURN_PROMPT_LIMIT } from './context.js';

test('assembles identity, self state, memory and relevant contexts in stable order',()=>{const output=buildTurnContext({identity:'Stable Soren',selfState:'Reading systems papers',retrievedMemory:'Shared preference',recentMessages:[{id:'1',conversationId:'chat-b',role:'user',content:'Local question',quotedMessageId:null,createdAt:'2026-09-14T00:00:00Z'}],projectName:'Novel',socialContext:'用户评论了 Soren 的动态',runtimeState:'online',sceneInstruction:'work carefully'});for(const title of ['Soren Identity / Core','Soren Self State','Relevant Shared Memory','Project Context','Recent Conversation','Relevant Social Context','Current Runtime State','Scene Instruction'])assert.ok(output.includes(title));assert.ok(output.indexOf('Soren Self State')<output.indexOf('Relevant Shared Memory'));assert.ok(output.indexOf('Project Context')<output.indexOf('Recent Conversation'));assert.equal((output.match(/Stable Soren/g)||[]).length,1);});

test('turn context remains bounded',()=>{const huge='x'.repeat(100000),output=buildTurnContext({identity:huge,selfState:huge,retrievedMemory:huge,recentMessages:[{id:'1',conversationId:'chat',role:'user',content:huge,quotedMessageId:null,createdAt:new Date().toISOString()}],socialContext:huge,runtimeState:huge,sceneInstruction:huge});assert.ok(output.length<=TURN_CONTEXT_LIMIT);});

test('complete turn prompt including text attachments remains bounded',()=>{const huge='x'.repeat(200000),output=buildTurnPrompt(huge,[huge,huge],huge);assert.ok(output.length<=TURN_PROMPT_LIMIT);assert.match(output,/Current User Message/);});
