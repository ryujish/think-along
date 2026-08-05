export type AuthProvider = 'email' | 'google' | 'apple';
export type AiProvider = 'GPT' | 'Claude' | 'Gemini';
export type ThinkingStatus = 'active' | 'trashed' | 'deleted';
export type ExportFormat = 'markdown' | 'pdf' | 'word' | 'notion';

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
  role: 'user' | 'assistant' | 'system';
  content: string;
  aiProvider?: AiProvider;
  createdAt: string;
};

export type Thinking = {
  id: string;
  userId: string;
  title: string;
  prompt: string;
  aiProvider: AiProvider;
  status: ThinkingStatus;
  folder?: string;
  favorite: boolean;
  tags: string[];
  insight?: string;
  answer: string;
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

export type AppDatabase = {
  users: User[];
  sessions: Session[];
  thinkings: Thinking[];
  messages: ConversationMessage[];
  attachments: Attachment[];
  insights: Insight[];
};

export type ApiError = {
  error: {
    code: string;
    message: string;
  };
};
