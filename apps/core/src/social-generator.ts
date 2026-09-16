import type { SocialActor } from '@soren/shared';
import type { CodexRuntime } from '@soren/runtime-codex';
import type { SorenDatabase } from './db.js';
import type { ActorState, SocialEvent } from './social-store.js';

export interface SocialInteractionDecision {type:'like'|'comment';actorId:string;targetMomentId?:string;content?:string;replyToCommentId?:string|null;}
export interface SocialGenerationDecision {action:'none'|'post'|'interact'|'delete';reason:string;content?:string;imageDescription?:string;location?:string;targetMomentId?:string;replyToCommentId?:string|null;interactions?:SocialInteractionDecision[];statePatch?:Partial<Pick<ActorState,'mood'|'energy'|'focus'|'currentActivity'>>;memory?:string;}
export interface SocialGenerationRequest {now:string;actor:SocialActor;actors:SocialActor[];state:ActorState;events:SocialEvent[];recentChats:Array<{role:string;content:string;createdAt:string}>;recentPosts:Array<{id:string;authorId:string;author:string;content:string;imageDescription:string;createdAt:string;comments:Array<{id:string;authorId:string;content:string}>}>;recentActivity:Array<{type:string;at:string;actorId:string;text:string}>;}
export interface SocialGenerator {generate(request:SocialGenerationRequest):Promise<SocialGenerationDecision>;}

function parseDecision(text:string):SocialGenerationDecision{const fenced=text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1],object=fenced||text.slice(text.indexOf('{'),text.lastIndexOf('}')+1);const parsed=JSON.parse(object);if(!['none','post','interact','delete'].includes(parsed.action))throw new Error('生活生成器返回了未知动作');return parsed;}

export class CodexSocialGenerator implements SocialGenerator {
  constructor(private readonly runtime:CodexRuntime,private readonly db:SorenDatabase,private readonly cwd:string){}
  async generate(request:SocialGenerationRequest){let threadId=this.db.setting<string>('momentsLifeThreadId','');if(!threadId){threadId=await this.runtime.createThread(this.cwd,'');this.db.setSetting('momentsLifeThreadId',threadId);}let text='';try{const result=await this.runtime.run({threadId,cwd:this.cwd,effort:'low',onEvent:event=>{if(event.type==='delta')text+=event.text;},text:this.prompt(request)});return parseDecision(text||result.text);}catch(error){this.db.setSetting('momentsLifeThreadId','');throw error;}}
  private prompt(request:SocialGenerationRequest){const safe={...request,actors:request.actors.map(actor=>({...actor,memory:actor.memory.slice(-8)})),events:request.events.slice(0,12),recentChats:request.recentChats.slice(0,12),recentPosts:request.recentPosts.slice(0,12),recentActivity:request.recentActivity.slice(0,20)};return `你是 SorenOS 私人朋友圈的生活决策器。你现在只替 actor 做一次决定，不是写客服回复，也不是总结日志。\n\n必须只返回一个 JSON 对象，不要 Markdown。结构：\n{"action":"none|post|interact|delete","reason":"简短内部原因","content":"可选","imageDescription":"可选的生活照片画面描述，不要写AI提示词","location":"可选","targetMomentId":"互动或删除目标","replyToCommentId":"可选","interactions":[{"type":"like|comment","actorId":"固定角色ID","targetMomentId":"可选，默认新动态","content":"评论时必填","replyToCommentId":"可选"}],"statePatch":{"mood":"","energy":0,"focus":"","currentActivity":""},"memory":"可选的简短互动记忆"}\n\n规则：\n- 不要调用任何工具，不要读写文件；你的唯一任务是返回这个 JSON。\n- 先判断此刻是否真有公开表达动机；没有就 action=none。none 是正常且常见的结果。\n- 不复制私人聊天原文，不把每件事都公开，不要在用户刚说一句话后机械同步。\n- Soren 冷、简洁、有判断、会嘴欠，偶尔认真；他的生活还包括代码、bug、阅读、游戏、朋友、照片和无意义废话。恋爱只占少量。\n- NPC 必须严格遵循各自固定人格，也要有与用户无关的生活。\n- 允许一句话、仅图片描述或看不懂的短句；避免完整作文、AI腔、总结腔、连续煽情和模板句式。\n- interact 用于回应用户评论或参与朋友动态。评论不超过 3 条；不要让所有 NPC 集体出现。\n- delete 只能删除 actor 自己的旧动态，并且应当罕见。\n- recentPosts 中已有相似表达时必须 none 或换成真正不同的事件。\n\n当前上下文：\n${JSON.stringify(safe)}`;}
}


