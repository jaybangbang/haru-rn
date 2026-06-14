export type EmotionKey = 'confident' | 'excited' | 'joy' | 'will' | 'complex' | 'worry' | 'tired';
export type PersonaKey = 'insighter' | 'wit' | 'coach';

export interface Emotion {
  key: EmotionKey;
  label: string;
  emoji: string;
}

export interface AIComment {
  persona: PersonaKey;
  tag: string;
  text: string;
  createdAt: number;
  replyTo?: number; // index into comments array at time of posting
}

export interface PendingComment {
  persona: PersonaKey;
  scheduledAt: number;
  order: number; // 1, 2, 3
  notifId?: string; // expo-notifications scheduled notification ID
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
  energyScore?: number;
  createdAt: number;
}

export interface WeeklySummary {
  weekKey: string; // 'YYYY-WW'
  title: string;
  subtitle: string;
  dateRange: string;
  comment: string;
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
}
