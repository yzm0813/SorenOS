import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTurnContext } from './context.js';

test('separates global identity, shared memory, local chat and project context',()=>{const output=buildTurnContext({identity:'Stable Soren',retrievedMemory:'Shared preference',recentMessages:[{id:'1',conversationId:'chat-b',role:'user',content:'Local question',quotedMessageId:null,createdAt:'2026-09-14T00:00:00Z'}],projectName:'Novel'});assert.match(output,/Soren Identity \/ Core/);assert.match(output,/Relevant Shared Memory/);assert.match(output,/Conversation-local Context/);assert.match(output,/Project Context/);assert.equal((output.match(/Stable Soren/g)||[]).length,1);});
