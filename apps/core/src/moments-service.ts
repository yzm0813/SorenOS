import type { SorenDatabase } from './db.js';
import { socialActors } from './social-actors.js';
import { SocialStore } from './social-store.js';

const clean=(value:unknown,max:number)=>String(value||'').trim().slice(0,max);
const dueAfter=(minimum:number,maximum:number)=>new Date(Date.now()+minimum+Math.random()*(maximum-minimum)).toISOString();

export class MomentsService {
  readonly social:SocialStore;
  constructor(store:SorenDatabase){this.social=new SocialStore(store);this.social.ensureActors(socialActors);}
  feed(limit=50,actorId=''){return{moments:this.social.feed(limit,actorId),actors:this.social.actors(),unreadCount:this.social.unreadCount()};}
  publishUser(input:{content?:unknown;location?:unknown;worldContext?:unknown;imageDescription?:unknown}){return this.social.createPost('user',{content:clean(input.content,10000),location:clean(input.location,160),worldContext:clean(input.worldContext,500),imageDescription:clean(input.imageDescription,1000),motivation:'manual'});}
  publishActor(actorId:string,input:{content?:unknown;location?:unknown;worldContext?:unknown;imageDescription?:unknown;motivation?:unknown;sourceEventId?:string|null}){if(actorId==='user')throw new Error('系统不能代替用户发布');return this.social.createPost(actorId,{content:clean(input.content,10000),location:clean(input.location,160),worldContext:clean(input.worldContext,500),imageDescription:clean(input.imageDescription,1000),motivation:clean(input.motivation,500)||'life-engine',sourceEventId:input.sourceEventId||null});}
  commentUser(momentId:string,input:{content?:unknown;replyToCommentId?:unknown}){const content=clean(input.content,2000);if(!content)throw new Error('评论不能为空');const comment=this.social.addComment(momentId,'user',content,clean(input.replyToCommentId,80)||null);if(!comment)throw new Error('动态或回复目标不存在');const post=this.social.post(momentId);if(post&&post.authorId!=='user'){const dueAt=dueAfter(30_000,6*60_000);this.social.addEvent({type:'user_comment',actorId:post.authorId,targetId:momentId,summary:`用户评论：${content}`,importance:8,dueAt,metadata:{commentId:comment.id,replyToCommentId:comment.replyToCommentId}});this.social.nudgeEvaluation(dueAt);}return comment;}
  commentAs(momentId:string,actorId:string,content:string,replyToCommentId:string|null=null){const comment=this.social.addComment(momentId,actorId,clean(content,2000),replyToCommentId);if(!comment)throw new Error('动态或回复目标不存在');return comment;}
  likeUser(momentId:string){const liked=this.social.toggleLike(momentId,'user'),post=this.social.post(momentId);if(liked&&post&&post.authorId!=='user'){const dueAt=dueAfter(10*60_000,3*60*60_000);this.social.addEvent({type:'user_like',actorId:post.authorId,targetId:momentId,summary:'用户赞了这条动态',importance:4,dueAt});this.social.nudgeEvaluation(dueAt);}return{liked,moment:this.social.post(momentId)};}
  likeAs(momentId:string,actorId:string){return this.social.toggleLike(momentId,actorId);}
  deleteUser(momentId:string){if(!this.social.deletePost(momentId,'user'))throw new Error('只能删除自己的动态');return{deleted:true};}
  read(ids:unknown){const selected=Array.isArray(ids)?ids.map(id=>clean(id,80)).filter(Boolean).slice(0,100):[];return{unreadCount:this.social.markRead(selected)};}
}
