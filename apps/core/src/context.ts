import type { ChatMessage } from '@soren/shared';

export const TURN_CONTEXT_LIMIT=32_000;
export const TURN_PROMPT_LIMIT=120_000;
export interface TurnContextInput{
  identity:string;
  selfState?:string;
  retrievedMemory:string;
  recentMessages:ChatMessage[];
  projectName?:string;
  socialContext?:string;
  runtimeState?:string;
  capabilities?:string;
  sceneInstruction?:string;
}

const section=(title:string,value:string|undefined,limit:number)=>value?.trim()?`=== ${title} ===\n${value.trim().slice(0,limit)}`:'';

export function buildTurnContext(input:TurnContextInput){
  const local=input.recentMessages.slice(-8).map(message=>`${message.role==='user'?'用户':'Soren'}：${message.content}`).join('\n').slice(-6000);
  const output=[
    section('Soren Identity / Core','Soren Core 是稳定身份；当前用户明确提供的现实事实优先于旧记忆和 Self State。\n'+input.identity,14000),
    section('Soren Self State',input.selfState,3000),
    section('Relevant Shared Memory',input.retrievedMemory,8000),
    input.projectName?section('Project Context',`当前 Workspace 项目：${input.projectName}。只在该项目目录内操作文件。`,1500):'',
    section('Recent Conversation',local,6000),
    section('Relevant Social Context',input.socialContext,3000),
    section('Current Runtime State',input.runtimeState,1000),
    section('Available Capabilities',input.capabilities,6000),
    section('Scene Instruction',input.sceneInstruction,1500)
  ].filter(Boolean).join('\n\n');
  return output.slice(0,TURN_CONTEXT_LIMIT);
}

export function buildTurnPrompt(context:string,attachments:string[],message:string){const attachmentContext=attachments.join('\n\n').slice(0,60_000),currentMessage=message.slice(0,27_000),output=[context.slice(0,TURN_CONTEXT_LIMIT),attachmentContext?`=== Relevant Attachments ===\n${attachmentContext}`:'',`=== Current User Message ===\n${currentMessage}`].filter(Boolean).join('\n\n');return output.slice(0,TURN_PROMPT_LIMIT);}
