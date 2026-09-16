import type { ChatMessage } from '@soren/shared';

export interface TurnContextInput {
  identity:string;
  retrievedMemory:string;
  recentMessages:ChatMessage[];
  projectName?:string;
  socialContext?:string;
  runtimeState?:string;
}

export function buildTurnContext(input:TurnContextInput){
  const local=input.recentMessages.slice(-8).map(message=>`${message.role==='user'?'用户':'Soren'}：${message.content}`).join('\n').slice(-6000);
  return [
    `=== Soren Identity / Core ===\n${input.identity}`,
    input.retrievedMemory?`=== Relevant Shared Memory ===\n${input.retrievedMemory}`:'',
    local?`=== Conversation-local Context ===\n${local}`:'',
    input.projectName?`=== Project Context ===\n当前 Workspace 项目：${input.projectName}。只在该项目目录内操作文件。`:'',
    input.socialContext?`=== Relevant Moments Context ===\n${input.socialContext}`:'',
    input.runtimeState?`=== Current Runtime State ===\n${input.runtimeState}`:''
  ].filter(Boolean).join('\n\n');
}
