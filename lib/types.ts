export type AuthProvider = 'email' | 'google' | 'apple';
export type AiProvider = 'GPT' | 'Claude' | 'Gemini' | 'Grok' | 'Kimi' | 'OpenCode Zen';
export type ProviderId = 'openai' | 'anthropic' | 'gemini' | 'xai' | 'moonshot' | 'opencode';
export type ConnectionStatus = 'unknown' | 'available' | 'unavailable';

export type ModelCapability = {
  id: string;
  text: true;
  vision?: boolean;
  files?: boolean;
  tools?: boolean;
  structuredOutput?: boolean;
  streaming?: boolean;
};

export type ProviderConnection = {
  id: string;
  userId?: string;
  provider: ProviderId;
  name: string;
  authKind: 'api_key' | 'oauth' | 'local';
  credentialRef: string;
  status: ConnectionStatus;
  models: ModelCapability[];
  lastErrorCode?: string;
  lastCheckedAt?: string;
};

export type ProviderCatalogItem = {
  id: ProviderId;
  label: AiProvider;
  connections: ProviderConnection[];
};
export type ThinkingStatus = 'active' | 'trashed' | 'deleted';
export type ExportFormat = 'markdown' | 'pdf' | 'word' | 'notion' | 'json';

export type User = {
  id: string;
  email: string;
  nickname: string;
  authProvider: AuthProvider;
  interests: string[];
  defaultAiProvider: AiProvider;
  createdAt: string;
  updatedAt: string;
};

export type Session = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
};

export type Attachment = {
  id: string;
  thinkingId: string;
  thinkalongSessionId: string;
  type: 'image' | 'file' | 'voice';
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
  createdAt: string;
};

export type ConversationMessage = {
  id: string;
  thinkingId: string;
  thinkalongSessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  aiProvider?: AiProvider;
  connectionId?: string;
  model?: string;
  contextVersion?: number;
  executionStatus?: 'succeeded' | 'failed';
  createdAt: string;
};

export type ContextMessage = Pick<ConversationMessage, 'role' | 'content'>;

export type DecisionStatus = 'reviewing' | 'confirmed' | 'superseded' | 'discarded';

export type DecisionMemory = {
  id: string;
  userId: string;
  thinkalongSessionId: string;
  statement: string;
  topic?: string;
  status: DecisionStatus;
  sourceMessageId?: string;
  supersedesDecisionId?: string;
  supersededByDecisionId?: string;
  createdAt: string;
  updatedAt: string;
};

export type ContextPacket = {
  thinkalongSessionId: string;
  version: number;
  system: string;
  summary?: string;
  decisions: Array<Pick<DecisionMemory, 'id' | 'statement'>>;
  messages: ContextMessage[];
};

export type RoutingMode = 'manual' | 'automatic';

export type ContextPolicy = {
  allowedProviders: AiProvider[];
  includeDecisions: boolean;
  includeRecentMessages: boolean;
  routingMode: RoutingMode;
};

export type InternalAgentRole = 'thinker' | 'critic' | 'synthesizer';

export type ToolDefinition = {
  id: 'session.context.inspect';
  name: string;
  risk: 'read';
};

export type SkillDefinition = {
  id: 'decision-review';
  name: string;
  agentRole: InternalAgentRole;
  allowedTools: ToolDefinition['id'][];
};

export type ToolRun = {
  id: string;
  userId: string;
  thinkalongSessionId: string;
  toolId: ToolDefinition['id'];
  status: 'succeeded' | 'failed';
  result?: Record<string, number>;
  createdAt: string;
};

export type SubAgentRun = {
  id: string;
  userId: string;
  thinkalongSessionId: string;
  role: InternalAgentRole;
  skillId?: SkillDefinition['id'];
  contextVersion: number;
  status: 'completed' | 'failed';
  output?: string;
  createdAt: string;
};

export type DomainEvent = {
  id: string;
  userId: string;
  thinkalongSessionId: string;
  type: 'decision.created' | 'decision.superseded' | 'model.executed' | 'tool.executed' | 'subagent.completed';
  data: Record<string, string | number | boolean | undefined>;
  createdAt: string;
};

export type Thinking = {
  id: string;
  thinkalongSessionId: string;
  userId: string;
  title: string;
  prompt: string;
  aiProvider: AiProvider;
  selectedConnectionId: string;
  selectedModel: string;
  contextPolicy: ContextPolicy;
  status: ThinkingStatus;
  folder?: string;
  favorite: boolean;
  tags: string[];
  insight?: string;
  answer: string;
  sessionSummary?: string;
  createdAt: string;
  updatedAt: string;
};

export type Insight = {
  id: string;
  userId: string;
  period: 'weekly' | 'monthly';
  title: string;
  summary: string;
  patterns: string[];
  recommendations: string[];
  createdAt: string;
};

export type ContextSnapshot = {
  id: string;
  userId: string;
  thinkalongSessionId: string;
  version: number;
  provider: AiProvider;
  connectionId: string;
  model: string;
  packet: ContextPacket;
  createdAt: string;
};

export type AppDatabase = {
  users: User[];
  sessions: Session[];
  thinkings: Thinking[];
  messages: ConversationMessage[];
  attachments: Attachment[];
  insights: Insight[];
  providerConnections: ProviderConnection[];
  decisions: DecisionMemory[];
  contextSnapshots: ContextSnapshot[];
  events: DomainEvent[];
  toolRuns: ToolRun[];
  subAgentRuns: SubAgentRun[];
};

export type ApiError = {
  error: {
    code: string;
    message: string;
  };
};
