import { DiaryEntry, WeeklySummary } from './types';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? '';

async function callClaude(system: string, user: string, maxTokens = 300): Promise<string> {
  const res = await fetch(`${API_BASE}/api/comment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, user, maxTokens }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`api error ${res.status}: ${errText}`);
  }
  const data = await res.json();
  return data.text ?? '';
}

function buildDayEnergy(entries: DiaryEntry[], referenceDate?: Date): { d: string; v: number }[] {
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const ref = referenceDate ?? new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ref);
    d.setDate(d.getDate() - (6 - i));
    const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    const entry = entries.find(e => e.date === dateStr);
    return { d: DOW[d.getDay()], v: entry?.energyScore ?? (entry ? 5 : 0) };
  });
}

function getWeekStart(year: number, week: number): Date {
  const jan1 = new Date(year, 0, 1);
  const days = (week - 1) * 7 - jan1.getDay() + 1;
  return new Date(year, 0, 1 + days);
}

function buildWeekMeta(weekKey: string, entries: DiaryEntry[]) {
  const [year, week] = weekKey.split('-');
  const weekNum = parseInt(week, 10);
  const start = getWeekStart(parseInt(year, 10), weekNum);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return {
    title: `${start.getMonth() + 1}월 ${weekNum}주차`,
    subtitle: '나의 한 주',
    dateRange: `${fmt(start)} ~ ${fmt(end)} · ${entries.length}개의 기록`,
  };
}

export async function generateWeeklySummaryV3(
  entries: DiaryEntry[],
  weekKey: string
): Promise<WeeklySummary> {
  const meta = buildWeekMeta(weekKey, entries);

  // 주차 기준 날짜 계산 (과거 주 에너지 차트 정확도)
  const [yearStr, weekStr] = weekKey.replace(/_.*$/, '').split('-');
  const weekStart = getWeekStart(parseInt(yearStr, 10), parseInt(weekStr, 10));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  if (entries.length === 0) {
    return {
      weekKey, ...meta,
      comment: '',
      keywords: [],
      suggestions: [],
      days: buildDayEnergy(entries, weekEnd),
      generatedAt: Date.now(),
      reportHeadline: '이번 주는 기록이 없어요',
      reportHeadlineBody: '일기를 쓰기 시작하면 분석이 가능해요.',
      reportPatterns: [],
      reportOpenQuestion: '',
      reportSuggestions: [],
    };
  }

  const entriesText = entries
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(e => `[${e.date} ${e.dateObj.dow}]\n${e.body}`)
    .join('\n\n---\n\n');

  const prompt = `이번 주 일기들:

${entriesText}

---

위 일기를 읽고 다음 JSON 형식으로만 응답해라:

{
  "headline": "이번 주 가장 중요한 사건이나 전환점 — 짧은 제목 한 문장",
  "headlineBody": "핵심 사건에 대한 설명 2-3문장",
  "patterns": [
    {"title": "반복 패턴 제목", "body": "설명 1-2문장"}
  ],
  "openQuestion": "이번 주에서 도출된 가장 중요한 미결 질문 1개, 물음표로 끝낼 것",
  "suggestions": [
    {"title": "행동 제안 제목 (동사로 시작)", "body": "구체적 설명 1-2문장"}
  ],
  "keywords": [{"w": "키워드", "c": 빈도수}]
}

규칙:
- patterns: 2-4개, 실제 반복된 것만
- suggestions: 2-4개, 구체적 행동 중심
- keywords: 5-8개`;

  try {
    const raw = await callClaude('너는 일기 분석 도구다. JSON만 출력해라.', prompt, 2000);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('no json');
    const parsed = JSON.parse(jsonMatch[0]);

    return {
      weekKey, ...meta,
      comment: parsed.headline ?? '',
      keywords: parsed.keywords ?? [],
      suggestions: [],
      days: buildDayEnergy(entries, weekEnd),
      generatedAt: Date.now(),
      reportHeadline: parsed.headline ?? '',
      reportHeadlineBody: parsed.headlineBody ?? '',
      reportPatterns: parsed.patterns ?? [],
      reportOpenQuestion: parsed.openQuestion ?? '',
      reportSuggestions: parsed.suggestions ?? [],
    };
  } catch (e) {
    console.error('[v3] generateWeeklySummaryV3 error:', e);
    return {
      weekKey, ...meta,
      comment: '',
      keywords: [],
      suggestions: [],
      days: buildDayEnergy(entries, weekEnd),
      generatedAt: Date.now(),
      reportHeadline: '분석 중 오류가 발생했어요',
      reportHeadlineBody: '잠시 후 다시 시도해보세요.',
      reportPatterns: [],
      reportOpenQuestion: '',
      reportSuggestions: [],
    };
  }
}
