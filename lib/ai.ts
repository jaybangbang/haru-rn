import { AIComment, DiaryEntry, PendingComment, PersonaKey, WeeklySummary } from './types';
import { getWeekKey } from './storage';

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

const PERSONA_PROMPTS: Record<PersonaKey, string> = {
  insighter: `너는 예리한 심리 관찰자야. 일기를 읽고 작성자가 미처 인식하지 못한 감정의 흐름이나 행동 패턴을 짚어줘.

규칙:
- 반드시 일기에 나온 구체적인 단어나 상황을 인용할 것
- "잘 하셨어요", "수고했어요" 같은 위로 금지
- 통찰을 주되 단정짓지 말 것 ("~인 것 같아", "~해보여" 식으로)
- 2문장. 한국어.`,

  wit: `너는 솔직하고 재치있는 친구야. 일기를 읽고 공감하되, 가볍게 웃을 수 있는 포인트나 따뜻한 한 마디를 건네줘.

규칙:
- 반드시 일기 내용의 구체적인 장면이나 감정에 반응할 것
- 억지 유머나 개그 금지. 자연스러운 공감에서 나오는 웃음
- 설교나 조언 절대 금지
- 1~2문장. 한국어.`,

  coach: `너는 냉철한 실행 코치야. 일기를 읽고 내일 당장 해볼 수 있는 작은 행동 하나를 제안해.

규칙:
- 반드시 일기에서 언급된 상황이나 고민에서 출발할 것
- 추상적인 제안("마음을 돌봐요") 금지. 구체적 행동("퇴근 후 10분만 걸어봐요")으로
- 제안 1개 + 이유 1문장. 총 2문장. 한국어.`,
};

const PERSONA_NAMES: Record<PersonaKey, string> = {
  insighter: '인사이터',
  wit: '유머',
  coach: '코치',
};

const TAGS: Record<PersonaKey, string> = {
  insighter: '패턴 발견',
  wit: '오늘의 위로',
  coach: '내일을 위한 제안',
};

// Schedule 3 pending comments with staggered random delays.
// First: 1–10 min. Subsequent: 2–10 min after previous (gap ensures "reading" time).
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

export async function generateSingleComment(
  entry: DiaryEntry,
  persona: PersonaKey,
  previousComments: AIComment[]
): Promise<AIComment> {
  const emotionStr = entry.emotions?.length
    ? `선택한 감정: ${entry.emotions.map(e => e.label).join(', ')}\n`
    : '';

  const diaryBlock = `날짜: ${entry.date} (${entry.dateObj.dow})\n${emotionStr}일기:\n${entry.body}`;

  let previousBlock = '';
  if (previousComments.length > 0) {
    const lines = previousComments.map(
      (c, i) => `[${i}] ${PERSONA_NAMES[c.persona]} (${c.tag}): ${c.text}`
    );
    previousBlock = `\n\n앞서 달린 댓글 (읽고 참고해):\n${lines.join('\n')}\n\n앞 댓글과 겹치는 포인트는 피해줘. 새 댓글(replyTo: null)을 달거나, 앞 댓글 중 하나에 답글(replyTo: 댓글 번호)을 달 수 있어.`;
  }

  const userMsg = `${diaryBlock}${previousBlock}\n\nJSON으로만 응답: {"replyTo": null 또는 숫자, "text": "내용"}`;

  try {
    const raw = await callClaude(PERSONA_PROMPTS[persona], userMsg, 300);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const text = (parsed.text ?? '').trim();
      const replyTo =
        typeof parsed.replyTo === 'number' &&
        parsed.replyTo >= 0 &&
        parsed.replyTo < previousComments.length
          ? parsed.replyTo
          : undefined;
      if (text) {
        return { persona, tag: TAGS[persona], text, createdAt: Date.now(), replyTo };
      }
    }
    // fallback: treat entire response as text
    return { persona, tag: TAGS[persona], text: raw.trim(), createdAt: Date.now() };
  } catch {
    return mockComment(entry, persona);
  }
}

function mockComment(entry: DiaryEntry, persona: PersonaKey): AIComment {
  const mocks: Record<PersonaKey, string> = {
    insighter: `일기에서 ${entry.body.length > 50 ? '여러 감정들이 교차하는' : '간결하지만 깊은'} 흐름이 느껴져요.`,
    wit: '오늘도 잘 버텼어요. 이 한 줄의 일기가 내일의 당신에게 작은 용기가 될 거예요.',
    coach: '오늘 느낀 감정 중 가장 강했던 것을 내일 아침에 한 번 더 떠올려보세요.',
  };
  return { persona, tag: TAGS[persona], text: mocks[persona], createdAt: Date.now() };
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

  const prompt = `다음은 이번 주 일기들입니다. JSON 형식으로 주간 분석을 작성해주세요.

일기:
${entriesText}

다음 JSON 형식으로만 응답하세요:
{
  "comment": "이번 주를 종합한 Insighter의 한 단락 코멘트 (2-3문장)",
  "keywords": [{"w": "키워드", "c": 빈도수}],
  "suggestions": [
    {"persona": "insighter", "kind": "인사이트", "title": "제목", "body": "내용 2-3문장", "metric": {"label": "라벨", "value": "값"}},
    {"persona": "coach", "kind": "행동 제안", "title": "제목", "body": "내용 2-3문장", "metric": {"label": "라벨", "value": "값"}},
    {"persona": "wit", "kind": "응원", "title": "제목", "body": "내용 2-3문장", "metric": {"label": "라벨", "value": "값"}}
  ]
}`;

  try {
    const raw = await callClaude('너는 일기 분석 AI다. JSON만 출력해라.', prompt, 1000);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('no json');
    const parsed = JSON.parse(jsonMatch[0]);

    const meta = buildWeekMeta(weekKey, entries);
    return {
      weekKey,
      ...meta,
      comment: parsed.comment ?? '',
      keywords: parsed.keywords ?? [],
      suggestions: parsed.suggestions ?? [],
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
      body: `${entries.length}개의 일기를 바탕으로 패턴을 살펴봤어요.`,
      metric: { label: '기록 수', value: `${entries.length}개` },
    }] : [],
    days: buildDayEnergy(entries),
    generatedAt: Date.now(),
  };
}
