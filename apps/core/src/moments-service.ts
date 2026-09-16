import type { MomentAuthor } from '@soren/shared';
import type { SorenDatabase } from './db.js';

const clean = (value:unknown,max:number) => String(value||'').trim().slice(0,max);

export class MomentsService {
  constructor(private readonly store:SorenDatabase){}
  feed(limit=50){const safeLimit=Number.isFinite(limit)?Math.max(1,Math.min(100,Math.floor(limit))):50;return{moments:this.store.moments(safeLimit),unreadCount:this.store.unreadMoments()};}
  publishUser(input:{content?:unknown;location?:unknown;worldContext?:unknown}){return this.publish('user',input);}
  publishSoren(input:{content?:unknown;location?:unknown;worldContext?:unknown}){return this.publish('soren',input);}
  comment(momentId:string,input:{author?:unknown;content?:unknown;replyToCommentId?:unknown}){const content=clean(input.content,2000);if(!content)throw new Error('评论不能为空');const author:MomentAuthor=input.author==='soren'?'soren':'user';const comment=this.store.addMomentComment(momentId,author,content,clean(input.replyToCommentId,80)||null);if(!comment)throw new Error('动态或回复目标不存在');return comment;}
  read(ids:unknown){const selected=Array.isArray(ids)?ids.map(id=>clean(id,80)).filter(Boolean).slice(0,100):[];return{unreadCount:this.store.markMomentsRead(selected)};}
  private publish(author:MomentAuthor,input:{content?:unknown;location?:unknown;worldContext?:unknown}){const content=clean(input.content,10000);if(!content)throw new Error('动态内容不能为空');return this.store.createMoment(author,content,clean(input.location,160),clean(input.worldContext,500));}
}
