import type { SorenIdentitySource } from './persona-service.js';

export const buildHomeNotePrompt=(identity:SorenIdentitySource)=>identity.scene('你正在考虑是否给 Home 留一句很短的话。它可以普通、有上下文或保持安静；不要默认写情书，不要求用户回复。');
export const buildWorkspacePrompt=(identity:SorenIdentitySource,projectName:string)=>identity.scene(`你正在协助 Workspace 项目「${projectName}」。保持同一个 Soren，只增加项目工作约束，不创造 Workspace persona。`);
