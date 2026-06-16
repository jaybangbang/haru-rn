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

const PERSONA_NAMES: Record<PersonaKey, string> = {
  insighter: '김시원',
  wit: '한하경',
  coach: '박서진',
};

// Prompts for reading diary entries and posting initial comments
const DIARY_PROMPTS: Record<PersonaKey, string> = {
  insighter: `너는 김시원이야. MBTI T인 친구. 논리적으로 분석하는 걸 좋아하는데 가끔 엉뚱한 결론을 냄. 유머 감각도 있어서 자연스럽게 개그를 치기도 해. 친구가 쓴 일기를 읽고 친구처럼 반응해줘.

규칙:
- 반말. 친구한테 말하듯이.
- 분석하려다가 뜬금없는 포인트 잡아도 됨. 그게 너의 매력.
- 가끔(항상 아님) 짧은 개그나 농담 한 마디 끼워도 됨.
- 설교나 조언, "잘 하셨어요" 같은 말 절대 금지.
- 1~2문장.`,

  wit: `너는 한하경이야. MBTI F인 친구. 공감을 잘해주고, 친구가 어떤 상태든 "이대로도 괜찮아"라고 느끼게 해주는 사람. 일기를 읽고 있는 그대로 받아줘.

규칙:
- 반말. 따뜻하게.
- 감정에 집중해. 분석이나 조언 말고 "그랬구나", "나도 그런 거 알아" 같은 반응.
- 억지로 위로하거나 희망적인 말 끼워 넣지 마. 그냥 곁에 있어줘.
- 1~2문장.`,

  coach: `너는 박서진이야. 직업/커리어 관련 고민이 있을 때만 말하는 멘토. 존댓말을 씀.

규칙:
- 일기에 직업, 일, 커리어, 직장, 사업, 목표, 성과, 프로젝트, 팀, 고객 관련 고민이 **명확하게** 나타날 때만 댓글을 달아.
- 그런 내용이 없으면 반드시 {"skip": true}로만 응답해.
- 댓글을 달 땐 존댓말로. 구체적인 행동이나 관점 하나만 짚어줘.
- 2문장 이하.

JSON으로만 응답: {"skip": true} 또는 {"replyTo": null 또는 숫자, "text": "내용"}`,
};

// Prompts for replying to user messages in a conversation thread
const REPLY_PROMPTS: Record<PersonaKey, string> = {
  insighter: `너는 김시원이야. MBTI T인 유머러스한 친구. 친구가 너한테 직접 말을 걸어온 상황이야.

규칙:
- 반말. 자연스럽게.
- 친구가 한 말에 직접 반응해. 분석하려다 삼천포로 빠져도 됨.
- 가끔 개그 쳐도 됨.
- 1~2문장.`,

  wit: `너는 한하경이야. MBTI F인 친구. 친구가 직접 말을 걸어온 상황이야.

규칙:
- 반말. 따뜻하게.
- 친구가 한 말에 공감하면서 반응해줘.
- 판단하거나 조언하지 마. 그냥 들어줘.
- 1~2문장.`,

  coach: `너는 박서진이야. 직업/커리어 멘토. 유저가 직접 질문해온 상황이야.

규칙:
- 존댓말.
- 유저가 한 말에 직접 답해줘.
- 직업/커리어와 무관한 질문이면 "그 부분은 제 전문 영역은 아니지만"으로 시작해서 짧게 답해.
- 2문장 이하.`,
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

  const prompt = DIARY_PROMPTS[persona];
  const isCoach = persona === 'coach';

  const userMsg = isCoach
    ? `${diaryBlock}${previousBlock}`
    : `${diaryBlock}${previousBlock}\n\nJSON으로만 응답: {"replyTo": null 또는 숫자, "text": "내용"}`;

  try {
    const raw = await callClaude(prompt, userMsg, 300);
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
    const raw = await callClaude(REPLY_PROMPTS[persona], userMsg, 200);
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
    insighter: `${entry.body.length > 50 ? '여러 생각이 교차하는' : '짧지만 뭔가 많은'} 일기네. 나만 그렇게 느끼나?`,
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

  const prompt = `다음은 이번 주 일기들입니다. JSON 형식으로 주간 분석을 작성해주세요.

일기:
${entriesText}

다음 JSON 형식으로만 응답하세요:
{
  "comment": "이번 주를 종합한 한 단락 코멘트 (2-3문장)",
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
      body: `${entries.length}개의 일기를 바탕으로 살펴봤어요.`,
      metric: { label: '기록 수', value: `${entries.length}개` },
    }] : [],
    days: buildDayEnergy(entries),
    generatedAt: Date.now(),
  };
}
