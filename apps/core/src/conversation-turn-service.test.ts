import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { SorenDatabase } from './db.js';
import { EventService } from './event-service.js';
import { ReminderService } from './reminder-service.js';
import { CyberDaddyService } from './cyberdaddy-service.js';
import { ScheduleActionService } from './schedule-actions.js';
import { ConversationTurnService } from './conversation-turn-service.js';

function setup(executeFailure=false){const directory=mkdtempSync(join(tmpdir(),'soren-turn-action-')),db=new SorenDatabase(join(directory,'soren.db')),events=new EventService(db),clock=()=>new Date('2026-09-17T13:55:00.000Z'),reminders=new ReminderService(db,events,clock),cyberDaddy=new CyberDaddyService(db,events,clock),realActions=new ScheduleActionService(db,reminders,cyberDaddy,clock),scheduleActions=executeFailure?{prompt:()=>realActions.prompt(),execute:()=>{throw new Error('database unavailable');}}:realActions,conversation=db.createConversation('手机 Chat'),stream:any[]=[];const codex={createThread:async()=> 'thread-1',run:async(input:any)=>{const text='<soren_actions>{"actions":[{"type":"create_reminder","title":"看看有没生效","delayMinutes":2,"timezone":"Asia/Shanghai"}]}</soren_actions>';input.onEvent({type:'delta',text});return{turnId:'codex-turn-1',text};},cancel:async()=>{}},http={json:()=>{},sse:()=>((event:any)=>stream.push(event))},turns=new ConversationTurnService({db,memory:{recall:async()=>({content:'',degraded:false}),remember:async()=>{}},workspace:{changedPaths:async()=>[]},codex,chatRuntime:{start:async()=>{}},scheduleActions,socialLife:{recordEvent:()=>{}},moments:{social:{recentActivity:()=>[]}},persona:{text:async()=> 'Soren'},selfState:{context:()=>''},workspaceRoot:directory,attachmentRoot:join(directory,'attachments'),http});return{directory,db,reminders,conversation,stream,turns};}

test('Chat structured action creates a persisted reminder before confirmation',async()=>{const state=setup();try{await state.turns.run(state.conversation.id,{message:'2分钟之后提醒我看看有没生效'}, {end:()=>{}});const messages=state.db.messages(state.conversation.id),reminder=state.reminders.list()[0];assert.equal(reminder.title,'看看有没生效');assert.equal(reminder.sourceConversationId,state.conversation.id);assert.equal(messages.at(-1)?.role,'assistant');assert.match(messages.at(-1)?.content||'',/21:57/);assert.ok(state.stream.some(item=>item.type==='tool.completed'&&item.tool==='soren.schedule'));assert.ok(state.stream.some(item=>item.type==='turn.completed'));assert.ok(!state.stream.some(item=>String(item.text||'').includes('<soren_actions>')));}finally{state.db.close();rmSync(state.directory,{recursive:true,force:true});}});

test('Chat never confirms a reminder when persistence fails',async()=>{const state=setup(true);try{await state.turns.run(state.conversation.id,{message:'2分钟后提醒我喝水'}, {end:()=>{}});assert.equal(state.reminders.list().length,0);assert.equal(state.db.messages(state.conversation.id).filter(item=>item.role==='assistant').length,0);const failure=state.stream.find(item=>item.type==='turn.error');assert.equal(failure?.code,'scheduling_failed');assert.equal(failure?.message,'提醒没创建成功，再试一次。');}finally{state.db.close();rmSync(state.directory,{recursive:true,force:true});}});
