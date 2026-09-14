export type ThinkingMode = 'off' | 'auto' | 'always';
export type ThinkingDepth = 'quick' | 'deep';
export type ToolPermissionLevel = 'always_allow' | 'ask_each_time' | 'disabled';

export interface Conversation {
  id: string;
  title: string;
  codexThreadId: string | null;
  defaultModel: string;
  thinkingMode: ThinkingMode;
  thinkingDepth: ThinkingDepth;
  projectId: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  quotedMessageId: string | null;
  createdAt: string;
}

export interface WorkspaceProject {
  id: string;
  name: string;
  directory: string;
  type: 'web' | 'markdown' | 'files';
  gitStatus: string;
  previewEntry: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceFile {
  path: string;
  type: 'file' | 'directory';
  size: number;
  modifiedAt: string;
  status: string;
}

export interface ToolPermission {
  server: string;
  tool: string;
  permission: ToolPermissionLevel;
  risk: 'low' | 'medium' | 'high';
}

export type TurnEvent =
  | { type: 'assistant.delta'; conversationId: string; turnId: string; text: string }
  | { type: 'thinking.summary'; conversationId: string; turnId: string; text: string }
  | { type: 'tool.started' | 'tool.completed'; conversationId: string; turnId: string; tool: string }
  | { type: 'file.changed'; conversationId: string; turnId: string; projectId: string; paths: string[] }
  | { type: 'turn.completed'; conversationId: string; turnId: string; messageId: string }
  | { type: 'turn.error'; conversationId: string; turnId: string; message: string };
