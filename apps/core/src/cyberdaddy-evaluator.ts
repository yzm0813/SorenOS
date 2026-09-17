import type { Commitment, CyberDaddyDomain, FollowUpAction } from '@soren/shared';

export interface CyberDaddyEvaluationInput {
  commitment: Commitment;
  domain: CyberDaddyDomain;
  now: Date;
  recentUserContext: string;
}

export interface CyberDaddyDecision {
  action: FollowUpAction;
  message: string;
  reason: string;
  nextEligibleFollowUpAt: string | null;
}

export interface CyberDaddyContextEvaluator {
  evaluate(input: CyberDaddyEvaluationInput): Promise<CyberDaddyDecision>;
}

const burdenPattern=/(累|疲惫|生病|不舒服|医院|家里.{0,6}(急事|出事)|急事|崩溃|失眠|没睡|exhausted|sick|emergency)/i;
const next=(at:Date,minutes:number|null)=>minutes==null?null:new Date(at.getTime()+minutes*60_000).toISOString();
export const hasObviousHighBurden=(context:string)=>burdenPattern.test(context);

export class RuleBasedCyberDaddyEvaluator implements CyberDaddyContextEvaluator {
  async evaluate({commitment,domain,now,recentUserContext}:CyberDaddyEvaluationInput):Promise<CyberDaddyDecision>{const count=commitment.recurrence==='daily'?commitment.cycleFollowUpCount:commitment.followUpCount;
    if(hasObviousHighBurden(recentUserContext))return{action:count?'CHECK_IN':'REDUCE_TASK',message:count?'今天状态不对，这件事先不追进度。你只要告诉我：继续、缩小，还是推迟。':`我记得你答应了「${commitment.description}」。但今天先缩小一点，做十分钟就算开始；实在不行就告诉我推迟。`,reason:'近期聊天显示用户负担较重',nextEligibleFollowUpAt:commitment.recurrence==='daily'?null:next(now,domain.intensity==='daddy'?180:720)};
    if(commitment.recurrence==='daily'){const message=domain.intensity==='gentle'?`今天也提醒一下：${commitment.description}。不急着回。`:domain.intensity==='daddy'?`到今天的时间了：${commitment.description}。去做，别拿明天替今天。`:`今天的「${commitment.description}」到时间了。`;return{action:'REMIND',message,reason:'每日承诺本周期提醒',nextEligibleFollowUpAt:null};}
    if(domain.intensity==='gentle')return{action:'REMIND',message:`提醒一下：${commitment.description}。不急着现在回。`,reason:'Gentle 只做一次轻提醒',nextEligibleFollowUpAt:null};
    if(domain.intensity==='daddy'){const messages=count===0?`该兑现了：${commitment.description}。告诉我你现在开始，还是给我一个明确的新时间。`:count===1?`我还记得「${commitment.description}」。进度给我，哪怕只做了第一步。`:`回来确认一下：${commitment.description}。继续、缩小，或者改时间，选一个。`;return{action:count?'FOLLOW_UP':'REMIND',message:messages,reason:count?'Daddy Mode 持续但有限地跟进':'承诺已到期',nextEligibleFollowUpAt:next(now,[90,180,360,720][Math.min(count,3)])};}
    return{action:count?'FOLLOW_UP':'REMIND',message:count?`我回来确认一下「${commitment.description}」。做了多少，或者需要改到几点？`:`你之前答应了「${commitment.description}」。现在还做吗？`,reason:count?'Normal 对未完成承诺进行有限跟进':'承诺已到期',nextEligibleFollowUpAt:count>=2?null:next(now,count===1?720:240)};
  }
}

// Adapter boundary for a future Codex-backed evaluator. The caller must inject a
// delegate that already includes the shared Soren Core identity. No persona or
// memory is owned by this adapter.
export class CodexCyberDaddyEvaluator implements CyberDaddyContextEvaluator {
  constructor(private readonly delegate:(input:CyberDaddyEvaluationInput)=>Promise<unknown>){}
  async evaluate(input:CyberDaddyEvaluationInput){const raw=await this.delegate(input) as any,actions:FollowUpAction[]=['NO_ACTION','REMIND','FOLLOW_UP','REDUCE_TASK','POSTPONE','CHECK_IN'];if(!raw||!actions.includes(raw.action))throw new Error('context evaluator returned an invalid action');const nextAt=raw.nextEligibleFollowUpAt==null?null:String(raw.nextEligibleFollowUpAt);if(nextAt&&!Number.isFinite(Date.parse(nextAt)))throw new Error('context evaluator returned an invalid nextEligibleFollowUpAt');return{action:raw.action,message:String(raw.message||'').slice(0,4000),reason:String(raw.reason||'contextual evaluator').slice(0,500),nextEligibleFollowUpAt:nextAt};}
}
