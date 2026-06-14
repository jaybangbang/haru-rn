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
}

export interface DiaryEntry {
  id: string;
  date: string; // 'YYYY.MM.DD'
  dateObj: { y: number; m: number; d: number; dow: string };
  body: string;
  preview: string;
  emotions: Emotion[];
  comments: AIComment[];
  energyScore?: number; // 1-10, optional (AI-estimated)
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
