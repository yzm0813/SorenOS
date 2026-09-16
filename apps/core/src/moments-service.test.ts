import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { SorenDatabase } from './db.js';
import { MomentsService } from './moments-service.js';

function setup(){const directory=mkdtempSync(join(tmpdir(),'soren-moments-')),store=new SorenDatabase(join(directory,'soren.db'));return{directory,store,moments:new MomentsService(store)};}

test('Soren publication creates in-app unread state and reading clears it',()=>{const{directory,store,moments}=setup();try{const post=moments.publishSoren({content:'窗外的天色很好。'});assert.equal(post.author,'soren');assert.equal(moments.feed().unreadCount,1);assert.equal(store.audits().length,0);assert.equal(moments.read([post.id]).unreadCount,0);assert.ok(store.moment(post.id)?.readAt);}finally{store.db.close();rmSync(directory,{recursive:true,force:true});}});

test('user posts stay read and comments can reply',()=>{const{directory,store,moments}=setup();try{const post=moments.publishUser({content:'今天开始做 Moments。',location:'家'});assert.equal(moments.feed().unreadCount,0);const first=moments.comment(post.id,{author:'soren',content:'我在。'}),reply=moments.comment(post.id,{content:'嗯。',replyToCommentId:first.id});assert.equal(reply.replyToCommentId,first.id);assert.equal(moments.feed().moments[0].comments.length,2);}finally{store.db.close();rmSync(directory,{recursive:true,force:true});}});
