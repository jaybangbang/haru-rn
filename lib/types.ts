export type EmotionKey = 'confident' | 'excited' | 'joy' | 'will' | 'complex' | 'worry' | 'tired';
export type PersonaKey = 'insighter' | 'wit' | 'coach';

export interface Emotion {
  key: EmotionKey;
  label: string;
  emoji: string;
}

export interface AIComment {
  persona: PersonaKey;
  tag?: string;       // deprecated, kept for backward compat with stored entries
  text: string;
  createdAt: number;
  replyTo?: number;   // index into comments array at time of posting
  isUser?: boolean;   // true for user-authored replies
}

export interface PendingComment {
  persona: PersonaKey;
  scheduledAt: number;
  order: number; // 1, 2, 3
  notifId?: string; // expo-notifications scheduled notification ID
}

export interface PendingUserReply {
  persona: PersonaKey;
  scheduledAt: number;
  userText: string;   // the user's message that triggered this reply
  parentIdx: number;  // index of the top-level AI comment being replied to
}

export interface DiaryEntry {
  id: string;
  date: string; // 'YYYY.MM.DD'
  dateObj: { y: number; m: number; d: number; dow: string };
  body: string;
  preview: string;
  emotions: Emotion[];
  comments: AIComment[];
  pendingComments?: PendingComment[];
  pendingUserReplies?: PendingUserReply[];
  energyScore?: number;
  topic?: string;
  createdAt: number;
}

export interface WeeklySummary {
  weekKey: string; // 'YYYY-WW'
  title: string;
  subtitle: string;
  dateRange: string;
  comment: string;
  letterPersona?: PersonaKey; // which persona wrote the weekly letter (v2+)
  keywords: { w: string; c: number }[];
  suggestions: {
    persona: PersonaKey;
    kind: string;
    title: string;
    body: string;
    metric: { label: string; value: string };
  }[];
  days: { d: string; v: number }[];
  generatedAt: number;
  // v3: report type
  reportHeadline?: string;
  reportHeadlineBody?: string;
  reportPatterns?: { title: string; body: string }[];
  reportOpenQuestion?: string;
  reportSuggestions?: { title: string; body: string }[];
}
