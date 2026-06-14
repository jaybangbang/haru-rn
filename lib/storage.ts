import { documentDirectory, getInfoAsync, readAsStringAsync, writeAsStringAsync, makeDirectoryAsync } from 'expo-file-system/legacy';
import { DiaryEntry, WeeklySummary } from './types';

const BASE = documentDirectory!;
const ENTRIES_FILE = `${BASE}haru_entries.json`;
const WEEKLY_DIR = `${BASE}haru_weekly/`;
const LAST_READ_FILE = `${BASE}haru_last_read.json`;

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const info = await getInfoAsync(path);
    if (!info.exists) return null;
    const raw = await readAsStringAsync(path);
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await writeAsStringAsync(path, JSON.stringify(data));
}

export async function loadEntries(): Promise<DiaryEntry[]> {
  return (await readJson<DiaryEntry[]>(ENTRIES_FILE)) ?? [];
}

export async function saveEntry(entry: DiaryEntry): Promise<void> {
  const all = await loadEntries();
  const idx = all.findIndex(e => e.id === entry.id);
  if (idx >= 0) {
    all[idx] = entry;
  } else {
    all.unshift(entry);
  }
  await writeJson(ENTRIES_FILE, all);
}

export async function deleteEntry(id: string): Promise<void> {
  const all = await loadEntries();
  await writeJson(ENTRIES_FILE, all.filter(e => e.id !== id));
}

export async function loadWeeklySummary(weekKey: string): Promise<WeeklySummary | null> {
  await makeDirectoryAsync(WEEKLY_DIR, { intermediates: true }).catch(() => {});
  return readJson<WeeklySummary>(`${WEEKLY_DIR}${weekKey}.json`);
}

export async function saveWeeklySummary(summary: WeeklySummary): Promise<void> {
  await makeDirectoryAsync(WEEKLY_DIR, { intermediates: true }).catch(() => {});
  await writeJson(`${WEEKLY_DIR}${summary.weekKey}.json`, summary);
}

export async function getLastReadAt(): Promise<number> {
  try {
    const info = await getInfoAsync(LAST_READ_FILE);
    if (!info.exists) return 0;
    const raw = await readAsStringAsync(LAST_READ_FILE);
    return (JSON.parse(raw) as { ts: number }).ts ?? 0;
  } catch { return 0; }
}

export async function setLastReadAt(ts: number): Promise<void> {
  await writeAsStringAsync(LAST_READ_FILE, JSON.stringify({ ts }));
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
