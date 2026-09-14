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

export interface WeatherLocation {
  name: string;
  admin1: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface WeatherSnapshot {
  status: 'ready' | 'unconfigured' | 'unavailable';
  location: WeatherLocation | null;
  temperature: number | null;
  apparentTemperature: number | null;
  minimum: number | null;
  maximum: number | null;
  precipitationProbability: number | null;
  weatherCode: number | null;
  label: string;
  isDay: boolean | null;
  observedAt: string | null;
}

export interface HomeNote {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface HomeTodayItem {
  type: 'chat' | 'workspace' | 'reminder' | 'timeline';
  id: string;
  title: string;
  detail: string;
  occurredAt: string;
}

export interface HomeSnapshot {
  note: HomeNote;
  weather: WeatherSnapshot;
  today: HomeTodayItem[];
  moments: { unreadCount: number; available: boolean };
}

export type MemoryScope = 'core' | 'long_term' | 'project' | 'temporary';
export type MemorySyncStatus = 'pending' | 'synced' | 'failed';

export interface MemoryRecord {
  id: string;
  fingerprint: string;
  title: string;
  content: string;
  scope: MemoryScope;
  projectId: string | null;
  importance: number;
  pinned: boolean;
  sourceType: 'chat' | 'manual' | 'seed' | 'system';
  sourceId: string | null;
  provenance: string;
  remoteId: string | null;
  syncStatus: MemorySyncStatus;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MemorySeedItem {
  title?: string;
  content: string;
  scope?: MemoryScope;
  projectId?: string | null;
  importance?: number;
  pinned?: boolean;
  provenance?: string;
}

export type TurnEvent =
  | { type: 'assistant.delta'; conversationId: string; turnId: string; text: string }
  | { type: 'thinking.summary'; conversationId: string; turnId: string; text: string }
  | { type: 'tool.started' | 'tool.completed'; conversationId: string; turnId: string; tool: string }
  | { type: 'file.changed'; conversationId: string; turnId: string; projectId: string; paths: string[] }
  | { type: 'turn.completed'; conversationId: string; turnId: string; messageId: string }
  | { type: 'turn.error'; conversationId: string; turnId: string; message: string };
