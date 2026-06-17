import { AIComment, DiaryEntry, PendingComment, PersonaKey, WeeklySummary } from './types';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? '';

async function callClaude(system: string, user: string, maxTokens = 300): Promise<string> {
  const res = await fetch(`${API_BASE}/api/comment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, user, maxTokens }),
  });
  if (!res.ok) throw new Error(`api error ${res.status}`);
  const data = await res.json();
  return data.text ?? '';
}

async function callClaudePersona(
  persona: PersonaKey,
  promptType: 'diary' | 'reply',
  user: string,
  maxTokens = 300
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/comment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ persona, promptType, user, maxTokens }),
  });
  if (!res.ok) throw new Error(`api error ${res.status}`);
  const data = await res.json();
  return data.text ?? '';
}

const PERSONA_NAMES: Record<PersonaKey, string> = {
  insighter: '김시원',
  wit: '한하경',
  coach: '유채아',
};


// Schedule 3 pending comments with staggered random delays.
// First: 1–10 min. Subsequent: 2–10 min after previous.
export function schedulePendingComments(fromTs: number): PendingComment[] {
  const personas: PersonaKey[] = ['insighter', 'wit', 'coach'];
  const shuffled = [...personas].sort(() => Math.random() - 0.5);
  const rand = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1) + min) * 60 * 1000;

  let t = fromTs;
  return shuffled.map((persona, i) => {
    t += i === 0 ? rand(1, 10) : rand(2, 10);
    return { persona, scheduledAt: t, order: i + 1 };
  });
}

// Returns null if the persona decides to skip (e.g. 박서진 with no career content)
export async function generateSingleComment(
  entry: DiaryEntry,
  persona: PersonaKey,
  previousComments: AIComment[]
): Promise<AIComment | null> {
  const emotionStr = entry.emotions?.length
    ? `선택한 감정: ${entry.emotions.map(e => e.label).join(', ')}\n`
    : '';

  const diaryBlock = `날짜: ${entry.date} (${entry.dateObj.dow})\n${emotionStr}일기:\n${entry.body}`;

  let previousBlock = '';
  if (previousComments.length > 0) {
    const lines = previousComments
      .filter(c => !c.isUser)
      .map((c, i) => `[${i}] ${PERSONA_NAMES[c.persona]}: ${c.text}`);
    if (lines.length > 0) {
      previousBlock = `\n\n앞서 달린 댓글:\n${lines.join('\n')}\n\n앞 댓글과 겹치는 포인트는 피해줘. 새 댓글(replyTo: null)을 달거나 앞 댓글 중 하나에 답글(replyTo: 댓글 번호)을 달 수 있어.`;
    }
  }

  const isCoach = persona === 'coach';
  const userMsg = isCoach
    ? `${diaryBlock}${previousBlock}`
    : `${diaryBlock}${previousBlock}\n\nJSON으로만 응답: {"replyTo": null 또는 숫자, "text": "내용"}`;

  try {
    const raw = await callClaudePersona(persona, 'diary', userMsg, 300);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      // Coach (or any persona) can skip
      if (parsed.skip === true) return null;

      const text = (parsed.text ?? '').trim();
      const replyTo =
        typeof parsed.replyTo === 'number' &&
        parsed.replyTo >= 0 &&
        parsed.replyTo < previousComments.filter(c => !c.isUser).length
          ? parsed.replyTo
          : undefined;
      if (text) {
        return { persona, text, createdAt: Date.now(), replyTo };
      }
    }
    // Non-JSON fallback (e.g. insighter/wit might respond without JSON wrapper)
    const text = raw.trim();
    if (text && !text.startsWith('{')) {
      return { persona, text, createdAt: Date.now() };
    }
    return mockComment(entry, persona);
  } catch {
    return mockComment(entry, persona);
  }
}

// Generate AI reply to a user's direct message in a comment thread
export async function generateUserReply(
  entry: DiaryEntry,
  persona: PersonaKey,
  userMessage: string,
  conversationHistory: AIComment[]
): Promise<AIComment> {
  const contextLines = conversationHistory
    .slice(-4)
    .map(c => `${c.isUser ? '유저' : PERSONA_NAMES[c.persona]}: ${c.text}`)
    .join('\n');

  const userMsg = `일기 요약: ${entry.preview}\n\n대화 맥락:\n${contextLines}\n\n유저: ${userMessage}`;

  try {
    const raw = await callClaudePersona(persona, 'reply', userMsg, 200);
    const text = raw.replace(/\{[\s\S]*\}/g, '').trim() || raw.trim();
    if (text) return { persona, text, createdAt: Date.now() };
  } catch {
    // fall through to mock
  }

  const fallbacks: Record<PersonaKey, string> = {
    insighter: '음… 그건 좀 더 생각해봐야 할 것 같은데.',
    wit: '그렇구나, 말해줘서 고마워.',
    coach: '말씀해주신 부분 잘 들었어요.',
  };
  return { persona, text: fallbacks[persona], createdAt: Date.now() };
}

function mockComment(entry: DiaryEntry, persona: PersonaKey): AIComment {
  const mocks: Record<PersonaKey, string> = {
    insighter: '오늘 하루도 수고했다! 뭐가 됐든 일단 움직인 것만으로도 충분해.',
    wit: '읽었어. 오늘 하루 고생했다.',
    coach: '오늘 일기에서 중요한 신호가 보여요. 천천히 생각해보세요.',
  };
  return { persona, text: mocks[persona], createdAt: Date.now() };
}

export async function generateWeeklySummary(
  entries: DiaryEntry[],
  weekKey: string
): Promise<WeeklySummary> {
  if (entries.length === 0) return buildFallbackSummary(entries, weekKey);

  const entriesText = entries
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(e => `[${e.date} ${e.dateObj.dow}]\n${e.body}`)
    .join('\n\n---\n\n');

  const prompt = `이번 주 일기들이야:

${entriesText}

---

너는 세 명의 친구 중 한 명이야:
- 김시원(insighter): 성장욕구 강하고 활기 넘치는 친구. 반말.
- 한하경(wit): 항상 내 편. 인간적인 면모를 발견하고 소중히 여겨주는 친구. 반말, 따뜻하게.
- 유채아(coach): 커리어 멘토. 직업/커리어 고민이 주를 이룰 때만 선택. 존댓말.

이번 주 일기를 다 읽고, 가장 어울리는 한 명을 골라서 그 친구처럼 짧은 편지를 써줘.
분석 보고서가 아니라 친구 DM처럼. 3~5문장.
이번 주 자주 나온 키워드도 추출해줘.

JSON으로만:
{
  "persona": "insighter" 또는 "wit" 또는 "coach",
  "letter": "편지 내용",
  "keywords": [{"w": "키워드", "c": 빈도수}]
}`;

  try {
    const raw = await callClaude('JSON만 출력해라.', prompt, 600);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('no json');
    const parsed = JSON.parse(jsonMatch[0]);

    const meta = buildWeekMeta(weekKey, entries);
    return {
      weekKey,
      ...meta,
      comment: parsed.letter ?? '',
      letterPersona: (parsed.persona as PersonaKey) ?? 'insighter',
      keywords: parsed.keywords ?? [],
      suggestions: [],
      days: buildDayEnergy(entries),
      generatedAt: Date.now(),
    };
  } catch {
    return buildFallbackSummary(entries, weekKey);
  }
}

function buildDayEnergy(entries: DiaryEntry[]): { d: string; v: number }[] {
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
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

function buildFallbackSummary(entries: DiaryEntry[], weekKey: string): WeeklySummary {
  const meta = buildWeekMeta(weekKey, entries);
  return {
    weekKey,
    ...meta,
    comment: entries.length === 0
      ? '이번 주는 아직 일기가 없어요. 첫 번째 일기를 써보세요!'
      : `이번 주 ${entries.length}개의 일기를 썼어요.`,
    keywords: [],
    suggestions: entries.length > 0 ? [{
      persona: 'insighter' as PersonaKey,
      kind: '인사이트',
      title: '이번 주 기록을 분석 중이에요',
      body: `${entries.length}개의 일기를 바탕으로 살펴봤어요.`,
      metric: { label: '기록 수', value: `${entries.length}개` },
    }] : [],
    days: buildDayEnergy(entries),
    generatedAt: Date.now(),
  };
}
