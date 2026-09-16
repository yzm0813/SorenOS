import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { SorenDatabase } from './db.js';
import { EventService } from './event-service.js';

function setup(){const directory=mkdtempSync(join(tmpdir(),'soren-events-')),db=new SorenDatabase(join(directory,'soren.db')),events=new EventService(db);return{directory,db,events};}

test('Home and Moments remain in-app-only and duplicate delivery is prevented',()=>{const{directory,db,events}=setup();try{events.emit({type:'home_note.created',sourceType:'home_note',sourceId:'note-1',title:'Home',body:'留在 Home'});events.emit({type:'home_note.created',sourceType:'home_note',sourceId:'note-1',title:'Home',body:'留在 Home'});events.emit({type:'moment.created',sourceType:'moment',sourceId:'moment-1',title:'朋友圈',body:'一条动态'});assert.equal(events.events().length,2);assert.deepEqual(events.notifications().map(item=>item.deliveryChannel),['in_app','in_app']);assert.ok(events.notifications().every(item=>item.status==='delivered'));}finally{db.db.close();rmSync(directory,{recursive:true,force:true});}});

test('proactive Chat is inserted once while disabled system delivery stays auditable',()=>{const{directory,db,events}=setup();try{const input={type:'assistant.proactive_message',sourceType:'soren',sourceId:'wake-1',title:'Soren',body:'睡了吗？'};const first=events.emit(input),second=events.emit(input),chat=first.notifications.find(item=>item.deliveryChannel==='chat')!,system=first.notifications.find(item=>item.deliveryChannel==='system')!;assert.equal(chat.status,'delivered');assert.equal(system.status,'suppressed');assert.equal(db.messages(chat.conversationId!).length,1);assert.equal(second.notifications.length,2);assert.equal(db.messages(chat.conversationId!).length,1);}finally{db.db.close();rmSync(directory,{recursive:true,force:true});}});

test('enabled system delivery moves from pending to delivered without duplicating Chat',()=>{const{directory,db,events}=setup();try{db.setSetting('systemNotificationsEnabled',true);const result=events.emit({type:'assistant.proactive_message',sourceType:'soren',sourceId:'wake-2',title:'Soren',body:'回来时看我一眼。'}),system=result.notifications.find(item=>item.deliveryChannel==='system')!;assert.equal(system.status,'pending');assert.equal(events.markDelivered(system.id)?.status,'delivered');assert.equal(events.notifications({channel:'system',status:'pending'}).length,0);}finally{db.db.close();rmSync(directory,{recursive:true,force:true});}});

test('important reminders use Chat and system policy while ordinary reminders stay in-app',()=>{const{directory,db,events}=setup();try{const ordinary=events.emit({type:'reminder.created',sourceType:'reminder',sourceId:'reminder-1',title:'喝水',body:'记得喝水'}),important=events.emit({type:'reminder.important',sourceType:'reminder',sourceId:'reminder-2',title:'出门',body:'十分钟后出门'});assert.deepEqual(ordinary.notifications.map(item=>item.deliveryChannel),['in_app']);assert.deepEqual(important.notifications.map(item=>item.deliveryChannel).sort(),['chat','system']);assert.equal(db.messages(important.notifications.find(item=>item.deliveryChannel==='chat')!.conversationId!).length,1);}finally{db.db.close();rmSync(directory,{recursive:true,force:true});}});
