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

export type MomentAuthor = 'user' | 'soren' | 'npc';
export type SocialActorKind = MomentAuthor;

export interface SocialActor {
  id: string;
  kind: SocialActorKind;
  nickname: string;
  avatar: string;
  personality: string;
  relationToSoren: string;
  relationToUser: string;
  memory: string[];
  active: boolean;
}

export interface MomentMedia {
  id: string;
  momentId: string;
  kind: 'image';
  path: string;
  mime: string;
  size: number;
  createdAt: string;
}

export interface MomentComment {
  id: string;
  momentId: string;
  author: MomentAuthor;
  authorId: string;
  actor: SocialActor;
  content: string;
  replyToCommentId: string | null;
  createdAt: string;
}

export interface MomentLike {
  id: string;
  momentId: string;
  actorId: string;
  actor: SocialActor;
  createdAt: string;
}

export interface MomentPost {
  id: string;
  author: MomentAuthor;
  authorId: string;
  actor: SocialActor;
  content: string;
  location: string;
  worldContext: string;
  imageDescription: string;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
  media: MomentMedia[];
  likes: MomentLike[];
  likedByUser: boolean;
  comments: MomentComment[];
}

export interface SocialLifeStatus {
  enabled: boolean;
  running: boolean;
  nextEvaluationAt: string | null;
  lastEvaluationAt: string | null;
  lastOutcome: string;
  generatedToday: number;
  dailyLimit: number;
}

export type DeliveryChannel = 'in_app' | 'chat' | 'system' | 'mobile_future';
export type NotificationStatus = 'pending' | 'delivered' | 'read' | 'suppressed';

export interface DomainEvent {
  id: string;
  type: string;
  sourceType: string;
  sourceId: string;
  title: string;
  body: string;
  payload: Record<string,unknown>;
  dedupeKey: string;
  occurredAt: string;
}

export interface NotificationRecord {
  id: string;
  eventId: string;
  type: string;
  sourceType: string;
  sourceId: string;
  deliveryChannel: DeliveryChannel;
  status: NotificationStatus;
  title: string;
  body: string;
  conversationId: string | null;
  messageId: string | null;
  createdAt: string;
  deliveredAt: string | null;
  readAt: string | null;
  dedupeKey: string;
}

export type CyberDaddyIntensity = 'gentle' | 'normal' | 'daddy';
export type CommitmentStatus = 'active' | 'completed' | 'cancelled';
export type CommitmentRecurrence = 'none' | 'daily';
export type FollowUpAction = 'NO_ACTION' | 'REMIND' | 'FOLLOW_UP' | 'REDUCE_TASK' | 'POSTPONE' | 'CHECK_IN';

export interface CyberDaddyDomain {
  id: string;
  name: string;
  enabled: boolean;
  intensity: CyberDaddyIntensity;
  settings: Record<string,unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Commitment {
  id: string;
  domainId: string;
  description: string;
  status: CommitmentStatus;
  targetAt: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  sourceConversationId: string | null;
  recurrence: CommitmentRecurrence;
  recurrenceTime: string | null;
  cycleKey: string | null;
  cycleFollowUpCount: number;
  lastFollowUpAt: string | null;
  nextFollowUpAt: string | null;
  followUpCount: number;
  metadata: Record<string,unknown>;
}

export interface CommitmentFollowUp {
  id: string;
  commitmentId: string;
  action: FollowUpAction;
  message: string;
  reason: string;
  eventId: string | null;
  createdAt: string;
}

export interface CyberDaddySnapshot {
  enabled: boolean;
  paused: boolean;
  quietStart: string;
  quietEnd: string;
  inQuietHours: boolean;
  running: boolean;
  lastPulseAt: string | null;
  lastOutcome: string;
  domains: CyberDaddyDomain[];
  commitments: Commitment[];
  followUps: CommitmentFollowUp[];
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

export interface SorenSelfState {
  currentInterests: string[];
  ongoingPersonalThreads: string[];
  recentReflections: string[];
  digitalLifeState: string;
  activePersonalProjects: string[];
  socialRelationships: Record<string,string>;
  lastMeaningfulLifeEvents: string[];
  updatedAt: string;
}

export interface PushSubscriptionRecord {
  id:string;
  endpoint:string;
  deviceLabel:string;
  createdAt:string;
  updatedAt:string;
  lastSuccessAt:string|null;
  failureCount:number;
  disabledAt:string|null;
}

export type PushDeliveryStatus='pending'|'sent'|'failed'|'suppressed'|'invalid_subscription';

export type TurnEvent =
  | { type: 'assistant.delta'; conversationId: string; turnId: string; text: string }
  | { type: 'thinking.summary'; conversationId: string; turnId: string; text: string }
  | { type: 'tool.started' | 'tool.completed'; conversationId: string; turnId: string; tool: string }
  | { type: 'file.changed'; conversationId: string; turnId: string; projectId: string; paths: string[] }
  | { type: 'turn.completed'; conversationId: string; turnId: string; messageId: string }
  | { type: 'turn.error'; conversationId: string; turnId: string; message: string };
