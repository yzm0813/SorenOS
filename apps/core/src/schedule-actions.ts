import type { ScheduledItem } from '@soren/shared';
import type { ReminderService } from './reminder-service.js';
import type { CyberDaddyService } from './cyberdaddy-service.js';
import type { SorenDatabase } from './db.js';

export const ACTION_OPEN='<soren_actions>';
export const ACTION_CLOSE='</soren_actions>';

type CreateReminderAction={type:'create_reminder';title:string;delayMinutes?:number;localDateTime?:string;timezone?:string};
type CreateCommitmentAction={type:'create_commitment';description:string;domainId?:string;targetLocalDateTime?:string;recurrence?:'none'|'daily';recurrenceTime?:string;timezone?:string};
type ListAction={type:'list_scheduled_items'};
type CancelAction={type:'cancel_scheduled_item';id:string};
type ClarifyAction={type:'request_clarification';question:string};
export type ScheduleAction=CreateReminderAction|CreateCommitmentAction|ListAction|CancelAction|ClarifyAction;

const pad=(value:number)=>String(value).padStart(2,'0');
const parts=(date:Date,timeZone:string)=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(item=>item.type!=='literal').map(item=>[item.type,item.value]));
export const localNow=(date:Date,timeZone:string)=>{const value=parts(date,timeZone);return`${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}:${value.second}`;};
export function zonedLocalToUtc(value:string,timeZone:string){const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);if(!match)throw new Error('时间格式无效');try{new Intl.DateTimeFormat('en',{timeZone}).format();}catch{throw new Error('时区无效');}const expected={year:match[1],month:match[2],day:match[3],hour:match[4],minute:match[5],second:match[6]||'00'},wall=Date.UTC(Number(expected.year),Number(expected.month)-1,Number(expected.day),Number(expected.hour),Number(expected.minute),Number(expected.second));let guess=wall;for(let index=0;index<3;index++){const actual=parts(new Date(guess),timeZone),rendered=Date.UTC(Number(actual.year),Number(actual.month)-1,Number(actual.day),Number(actual.hour),Number(actual.minute),Number(actual.second));guess=wall-(rendered-guess);}const verified=parts(new Date(guess),timeZone);for(const key of Object.keys(expected) as Array<keyof typeof expected>)if(verified[key]!==expected[key])throw new Error('这个本地时间不存在或不明确，请换一个具体时间');return new Date(guess);}

export const looksLikeSchedulingRequest=(text:string)=>/(提醒我|叫我|催我|监督我|安排.{0,6}(提醒|任务)|取消.{0,8}(提醒|承诺)|有哪些.{0,8}(提醒|承诺)|列出.{0,8}(提醒|承诺)|remind me|set (?:a )?reminder)/i.test(text);

export function parseScheduleActions(text:string):ScheduleAction[]{const start=text.indexOf(ACTION_OPEN),end=text.indexOf(ACTION_CLOSE);if(start<0||end<=start)return[];const raw=text.slice(start+ACTION_OPEN.length,end).trim();try{const value=JSON.parse(raw),actions=Array.isArray(value?.actions)?value.actions:[];return actions.filter((item:any)=>item&&typeof item.type==='string').slice(0,5);}catch{return[];}}

export class ScheduleActionService{
  constructor(private readonly db:SorenDatabase,private readonly reminders:ReminderService,private readonly cyberDaddy:CyberDaddyService,private readonly clock:()=>Date=()=>new Date()){}
  timezone(){return this.db.setting('userTimezone','Asia/Shanghai');}
  scheduledItems():ScheduledItem[]{const reminderItems=this.reminders.list().map(item=>({id:item.id,type:'reminder' as const,title:item.title,scheduledAt:item.remindAt,status:item.status,source:item.sourceConversationId?'Chat' as const:'Timeline' as const,sourceConversationId:item.sourceConversationId})),commitmentItems=this.cyberDaddy.commitments().map(item=>({id:item.id,type:'commitment' as const,title:item.description,scheduledAt:item.targetAt,status:item.status,source:item.sourceConversationId?'Chat' as const:'Timeline' as const,sourceConversationId:item.sourceConversationId}));return[...reminderItems,...commitmentItems].sort((a,b)=>Date.parse(b.scheduledAt||'')-Date.parse(a.scheduledAt||''));}
  prompt(){const timezone=this.timezone(),current=localNow(this.clock(),timezone),items=this.scheduledItems().filter(item=>item.status==='scheduled'||item.status==='active').slice(0,20).map(item=>`${item.id} | ${item.type} | ${item.title} | ${item.scheduledAt||'unscheduled'}`).join('\n')||'无';return`=== Scheduling Actions ===
当前时间：${current} ${timezone}。
当用户明确要求未来提醒、监督、列出或取消计划时，你必须只输出下面的结构化 action，不要口头承诺，不要添加其他正文：
${ACTION_OPEN}{"actions":[ACTION]}${ACTION_CLOSE}
可用 ACTION：
- 一次性提醒：{"type":"create_reminder","title":"喝水","delayMinutes":2,"timezone":"${timezone}"}
- 有明确日期时间的一次性提醒：{"type":"create_reminder","title":"面试","localDateTime":"2026-09-18T08:00:00","timezone":"${timezone}"}
- 需要持续监督的承诺：{"type":"create_commitment","description":"每天晚上11点前睡觉","domainId":"sleep","recurrence":"daily","recurrenceTime":"23:00","timezone":"${timezone}"}
- 列出：{"type":"list_scheduled_items"}
- 取消：{"type":"cancel_scheduled_item","id":"计划 ID"}
- 时间不明确：{"type":"request_clarification","question":"你想让我明天几点提醒？"}
相对时间使用 delayMinutes，由 Core 根据当前时间计算。带日期的时间使用 localDateTime，禁止输出 UTC 时间戳。只有“明天/明早/下午”而没有具体时刻时必须追问。普通一次提醒不要创建 commitment；只有监督、重复催促或需要 follow-up 时才创建 commitment。
当前计划：
${items}`;}

  execute(actions:ScheduleAction[],context:{conversationId:string;messageId:string;turnId:string}){const replies:string[]=[];for(const action of actions){const key=`chat:${context.messageId}:${JSON.stringify(action)}`;if(action.type==='request_clarification'){replies.push(String(action.question||'你想让我几点提醒？').slice(0,300));continue;}if(action.type==='list_scheduled_items'){const active=this.scheduledItems().filter(item=>item.status==='scheduled'||item.status==='active').slice(0,10);replies.push(active.length?`现在有这些计划：\n${active.map(item=>`- ${item.type==='reminder'?'提醒':'承诺'}：${item.title}（${this.display(item.scheduledAt)}）`).join('\n')}`:'现在没有待执行的提醒或承诺。');continue;}if(action.type==='cancel_scheduled_item'){const reminder=this.reminders.get(String(action.id||''));if(reminder){const cancelled=this.reminders.cancel(reminder.id);replies.push(cancelled?.status==='cancelled'?`已经取消「${cancelled.title}」。`:`「${cancelled?.title||reminder.title}」已经执行，不能再取消。`);continue;}const commitment=this.cyberDaddy.commitments().find(item=>item.id===String(action.id||''));if(commitment){this.cyberDaddy.updateCommitment(commitment.id,{status:'cancelled'});replies.push(`已经取消「${commitment.description}」。`);continue;}throw new Error('没有找到要取消的计划');}if(action.type==='create_reminder'){const timezone=this.validateTimezone(action.timezone),remindAt=this.resolveTime(action,timezone),reminder=this.reminders.create({title:action.title,remindAt:remindAt.toISOString(),timezone,sourceConversationId:context.conversationId,sourceMessageId:context.messageId,idempotencyKey:key,metadata:{createdBy:'chat_action'}});replies.push(`行，${this.display(reminder.remindAt)}叫你。`);continue;}if(action.type==='create_commitment'){const timezone=this.validateTimezone(action.timezone),recurrence=action.recurrence==='daily'?'daily':'none',domainId=this.validDomain(action.domainId);this.cyberDaddy.updateConfig({enabled:true});this.cyberDaddy.updateDomain(domainId,{enabled:true});const targetAt=recurrence==='none'?this.resolveCommitmentTime(action,timezone).toISOString():null,commitment=this.cyberDaddy.createCommitment({domainId,description:action.description,recurrence,recurrenceTime:action.recurrenceTime,targetAt,sourceConversationId:context.conversationId,metadata:{sourceMessageId:context.messageId,createdBy:'chat_action',timezone,idempotencyKey:key}});replies.push(recurrence==='daily'?`记下了。每天 ${commitment.recurrenceTime} 我会跟进「${commitment.description}」。`:`记下了，${this.display(commitment.targetAt)}我会跟进「${commitment.description}」。`);}}
    if(!replies.length)throw new Error('没有可执行的 scheduling action');return replies.join('\n\n');}

  private validateTimezone(value:unknown){const configured=this.timezone(),requested=String(value||configured);if(requested!==configured)throw new Error(`提醒必须使用当前时区 ${configured}`);return configured;}
  private resolveTime(action:CreateReminderAction,timezone:string){if(Number.isFinite(Number(action.delayMinutes))){const minutes=Number(action.delayMinutes);if(minutes<1||minutes>525600)throw new Error('相对提醒时间超出允许范围');return new Date(this.clock().getTime()+minutes*60_000);}if(action.localDateTime)return this.future(zonedLocalToUtc(action.localDateTime,timezone));throw new Error('提醒时间不明确，请提供具体时间');}
  private resolveCommitmentTime(action:CreateCommitmentAction,timezone:string){if(!action.targetLocalDateTime)throw new Error('承诺时间不明确，请提供具体时间');return this.future(zonedLocalToUtc(action.targetLocalDateTime,timezone));}
  private future(date:Date){if(date.getTime()<=this.clock().getTime())throw new Error('计划时间必须晚于现在');return date;}
  private validDomain(value:unknown){const id=String(value||'habits');return['sleep','study','career','fitness','projects','habits'].includes(id)?id:'habits';}
  private display(value:string|null){if(!value)return'未设置时间';return new Intl.DateTimeFormat('zh-CN',{timeZone:this.timezone(),month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));}
}
