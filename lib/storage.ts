import { DiaryEntry, WeeklySummary } from './types';
import { supabase } from './supabase';
import { ensureAuth } from './auth';

export async function loadEntries(): Promise<DiaryEntry[]> {
  const userId = await ensureAuth();
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToEntry);
}

export async function saveEntry(entry: DiaryEntry): Promise<void> {
  const userId = await ensureAuth();
  const { error } = await supabase
    .from('entries')
    .upsert({ ...entryToRow(entry), user_id: userId }, { onConflict: 'id' });
  if (error) throw error;
}

export async function deleteEntry(id: string): Promise<void> {
  const userId = await ensureAuth();
  const { error } = await supabase
    .from('entries')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function loadWeeklySummary(weekKey: string): Promise<WeeklySummary | null> {
  const userId = await ensureAuth();
  const { data, error } = await supabase
    .from('weekly_summaries')
    .select('data')
    .eq('week_key', weekKey)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? (data.data as WeeklySummary) : null;
}

export async function saveWeeklySummary(summary: WeeklySummary): Promise<void> {
  const userId = await ensureAuth();
  const { error } = await supabase
    .from('weekly_summaries')
    .upsert(
      { week_key: summary.weekKey, user_id: userId, data: summary, generated_at: summary.generatedAt },
      { onConflict: 'week_key,user_id' }
    );
  if (error) throw error;
}

export async function getLastReadAt(): Promise<number> {
  const userId = await ensureAuth();
  const { data } = await supabase
    .from('last_read')
    .select('ts')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.ts ?? 0;
}

export async function setLastReadAt(ts: number): Promise<void> {
  const userId = await ensureAuth();
  const { error } = await supabase
    .from('last_read')
    .upsert({ user_id: userId, ts }, { onConflict: 'user_id' });
  if (error) throw error;
}

export function generateId(): string {
  return `e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function getWeekKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const start = new Date(y, 0, 1);
  const week = Math.ceil(((date.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  return `${y}-${String(week).padStart(2, '0')}`;
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];

export function makeDateObj(date: Date) {
  return {
    y: date.getFullYear(),
    m: date.getMonth() + 1,
    d: date.getDate(),
    dow: DOW_KO[date.getDay()],
  };
}

function entryToRow(e: DiaryEntry) {
  return {
    id: e.id,
    date: e.date,
    date_obj: e.dateObj,
    body: e.body,
    preview: e.preview,
    emotions: e.emotions,
    comments: e.comments,
    pending_comments: e.pendingComments ?? [],
    energy_score: e.energyScore ?? null,
    topic: e.topic ?? null,
    created_at: e.createdAt,
  };
}

function rowToEntry(row: Record<string, unknown>): DiaryEntry {
  return {
    id: row.id as string,
    date: row.date as string,
    dateObj: row.date_obj as DiaryEntry['dateObj'],
    body: row.body as string,
    preview: row.preview as string,
    emotions: (row.emotions as DiaryEntry['emotions']) ?? [],
    comments: (row.comments as DiaryEntry['comments']) ?? [],
    pendingComments: (row.pending_comments as DiaryEntry['pendingComments']) ?? [],
    energyScore: row.energy_score as number | undefined,
    topic: row.topic as string | undefined,
    createdAt: row.created_at as number,
  };
}
