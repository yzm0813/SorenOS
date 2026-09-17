import type { SocialLifeStatus } from '@soren/shared';
import type { SorenDatabase } from './db.js';
import type { MomentsService } from './moments-service.js';
import type { SocialGenerationDecision, SocialGenerationRequest, SocialGenerator } from './social-generator.js';
import type { SelfStateService } from './self-state-service.js';

type PendingEvents=ReturnType<MomentsService['social']['pendingEvents']>;
const randomBetween=(minimum:number,maximum:number)=>minimum+Math.random()*(maximum-minimum);
const future=(minimumMinutes:number,maximumMinutes:number)=>new Date(Date.now()+randomBetween(minimumMinutes,maximumMinutes)*60_000).toISOString();

/** Experimental prototype. Phase 5.5 freezes this scope to fixes and safety work. */
export class SocialLifeEngine {
  private running=false;
  private timer:NodeJS.Timeout|null=null;
  readonly dailyLimit=4;
  readonly dailyInteractionLimit=12;
  constructor(private readonly db:SorenDatabase,private readonly moments:MomentsService,private readonly generator:SocialGenerator,private readonly selfState?:SelfStateService){}
  start(){if(this.timer)return;if(this.db.setting('momentsLifeEnabled',true)&&!this.db.setting('proactivePaused',false)&&!this.db.setting<string>('momentsNextEvaluationAt',''))this.db.setSetting('momentsNextEvaluationAt',future(10,45));this.timer=setInterval(()=>void this.pulse(),60_000);this.timer.unref();void this.pulse();}
  stop(){if(this.timer)clearInterval(this.timer);this.timer=null;}
  status():SocialLifeStatus{return{enabled:this.db.setting('momentsLifeEnabled',true)&&!this.db.setting('proactivePaused',false),running:this.running,nextEvaluationAt:this.db.setting<string|null>('momentsNextEvaluationAt',null),lastEvaluationAt:this.db.setting<string|null>('momentsLastEvaluationAt',null),lastOutcome:this.db.setting('momentsLastOutcome','尚未评估'),generatedToday:this.moments.social.generatedToday(),dailyLimit:this.dailyLimit};}
  recordEvent(input:{type:string;actorId?:string|null;targetId?:string|null;summary:string;importance?:number;privacy?:string;metadata?:Record<string,unknown>}){if(!this.db.setting('momentsLifeEnabled',true)||this.db.setting('proactivePaused',false))return null;const dueAt=future(input.importance&&input.importance>=8?10:45,input.importance&&input.importance>=8?90:360),event=this.moments.social.addEvent({...input,dueAt});this.moments.social.nudgeEvaluation(dueAt);return event;}
  async pulse(force=false){
    if(this.running)return this.status();
    const enabled=this.db.setting('momentsLifeEnabled',true)&&!this.db.setting('proactivePaused',false),next=this.db.setting<string>('momentsNextEvaluationAt','');
    if(!enabled||(!force&&next&&Date.parse(next)>Date.now()))return this.status();
    this.running=true;this.db.setSetting('momentsLastEvaluationAt',new Date().toISOString());
    try{
      const events=this.moments.social.pendingEvents(),replyDue=events.some(event=>event.type==='user_comment');
      if(replyDue&&this.moments.social.generatedInteractionsToday()>=this.dailyInteractionLimit){this.finish('今天的朋友圈互动已经足够多',future(180,600));return this.status();}
      if(!replyDue&&this.moments.social.generatedToday()>=this.dailyLimit){this.finish('达到今天的自然活动上限',future(240,900));return this.status();}
      const actor=this.chooseActor(events),decision=await this.generator.generate(this.request(actor.id,events));
      await this.apply(actor.id,decision,events);
      this.finish(`${actor.nickname}: ${decision.action} · ${decision.reason||'无补充'}`,decision.action==='post'?future(50,720):future(120,600));
    }catch(error:any){this.finish(`本轮保持安静：${String(error?.message||error).slice(0,180)}`,future(60,240));}
    finally{this.running=false;}
    return this.status();
  }
  private chooseActor(events:PendingEvents){const directed=events.find(event=>event.actorId&&event.type==='user_comment')||events.find(event=>event.actorId&&event.importance>=7),actors=this.moments.social.actors().filter(actor=>actor.id!=='user');if(directed){const actor=actors.find(item=>item.id===directed.actorId);if(actor)return actor;}const recent=this.moments.social.recentActivity(8).map(item=>item.actorId),weighted=actors.flatMap(actor=>{const base=actor.id==='soren'?3:2,penalty=recent.slice(0,3).filter(id=>id===actor.id).length;return Array(Math.max(1,base-penalty)).fill(actor);});return weighted[Math.floor(Math.random()*weighted.length)]||actors[0];}
  private request(actorId:string,events:PendingEvents):SocialGenerationRequest{const actor=this.moments.social.actor(actorId)!,recentChats=(this.db.db.prepare('SELECT role,content,created_at FROM messages ORDER BY created_at DESC LIMIT 12').all() as any[]).reverse().map(row=>({role:row.role,content:String(row.content).slice(0,500),createdAt:row.created_at}));return{now:new Date().toISOString(),actor,actors:this.moments.social.actors(),state:this.moments.social.state(actorId),selfState:actorId==='soren'?this.selfState?.get():undefined,events:events.slice(0,12),recentChats,recentPosts:this.moments.social.feed(12).map(post=>({id:post.id,authorId:post.authorId,author:post.actor.nickname,content:post.content,imageDescription:post.imageDescription,createdAt:post.createdAt,comments:post.comments.map(item=>({id:item.id,authorId:item.authorId,content:item.content}))})),recentActivity:this.moments.social.recentActivity(20)};}
  private async apply(actorId:string,decision:SocialGenerationDecision,events:PendingEvents){let newMomentId='';if(decision.action==='post'){const post=this.moments.publishActor(actorId,{content:decision.content||'',imageDescription:decision.imageDescription||'',location:decision.location||'',motivation:decision.reason||'life-engine',sourceEventId:events[0]?.id||null});newMomentId=post.id;}else if(decision.action==='interact'&&decision.targetMomentId&&decision.content){this.moments.commentAs(decision.targetMomentId,actorId,decision.content,decision.replyToCommentId||null);}else if(decision.action==='delete'&&decision.targetMomentId){this.moments.social.systemDeleteOwnPost(decision.targetMomentId,actorId);}for(const interaction of (decision.interactions||[]).slice(0,3)){const target=interaction.targetMomentId||newMomentId;if(!target||interaction.actorId==='user')continue;try{if(interaction.type==='like')this.moments.likeAs(target,interaction.actorId);else if(interaction.content)this.moments.commentAs(target,interaction.actorId,interaction.content,interaction.replyToCommentId||null);}catch{}}if(decision.statePatch)this.moments.social.updateState(actorId,decision.statePatch);if(decision.memory)this.moments.social.appendMemory(actorId,decision.memory);this.moments.social.consumeEvents(events.slice(0,12).map(event=>event.id));}
  private finish(outcome:string,next:string){this.db.setSetting('momentsLastOutcome',outcome);this.db.setSetting('momentsNextEvaluationAt',next);}
}
