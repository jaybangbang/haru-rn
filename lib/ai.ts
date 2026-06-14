import { AIComment, DiaryEntry, PersonaKey, WeeklySummary } from './types';
import { getWeekKey } from './storage';

const BASE = 'https://api.anthropic.com/v1/messages';

function getApiKey(): string | null {
  return process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? null;
}

async function callClaude(system: string, user: string, maxTokens = 200): Promise<string> {
  const key = getApiKey();
  if (!key || key === 'your_api_key_here') throw new Error('no api key');

  const res = await fetch(BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!res.ok) throw new Error(`claude error ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

const PERSONA_PROMPTS: Record<PersonaKey, string> = {
  insighter: `당신은 '인사이터'입니다. 일기 작성자의 패턴, 성장, 변화를 날카롭게 포착해 따뜻하게 전달합니다.
태그: "패턴 발견". 톤: 날카롭지만 따뜻한 관찰자. 2-3문장. 구체적 패턴이나 표현 언급. 한국어로 작성.`,

  wit: `당신은 '유머'입니다. 일기 작성자에게 따뜻한 위로와 유머로 공감합니다.
태그: "오늘의 위로". 톤: 재치있고 따뜻함. 1-3문장. 가볍고 공감되는 위로. 한국어로 작성.`,

  coach: `당신은 '코치'입니다. 일기를 바탕으로 구체적이고 실행 가능한 제안을 합니다.
태그: "내일을 위한 제안". 톤: 명확하고 실용적. 2문장. 구체적 행동 제안 1개 + 이유. 한국어로 작성.`,
};

const TAGS: Record<PersonaKey, string> = {
  insighter: '패턴 발견',
  wit: '오늘의 위로',
  coach: '내일을 위한 제안',
};

export async function generateComments(entry: DiaryEntry): Promise<AIComment[]> {
  const userMsg = `다음 일기에 댓글을 달아주세요:\n\n날짜: ${entry.date} (${entry.dateObj.dow})\n내용:\n${entry.body}`;
  const personas: PersonaKey[] = ['insighter', 'wit', 'coach'];
  const results: AIComment[] = [];

  for (const persona of personas) {
    try {
      const text = await callClaude(PERSONA_PROMPTS[persona], userMsg, 200);
      results.push({ persona, tag: TAGS[persona], text: text.trim(), createdAt: Date.now() });
    } catch {
      results.push(...generateMockComments(entry).filter(c => c.persona === persona));
    }
  }

  return results;
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
      : `이번 주 ${entries.length}개의 일기를 썼어요. API 키를 설정하면 더 상세한 분석을 받을 수 있어요.`,
    keywords: [],
    suggestions: entries.length > 0 ? [{
      persona: 'insighter' as PersonaKey,
      kind: '인사이트',
      title: '이번 주 기록을 분석 중이에요',
      body: `${entries.length}개의 일기를 바탕으로 패턴을 살펴봤어요. ANTHROPIC_API_KEY를 설정하면 더 깊은 인사이트를 받을 수 있어요.`,
      metric: { label: '기록 수', value: `${entries.length}개` },
    }] : [],
    days: buildDayEnergy(entries),
    generatedAt: Date.now(),
  };
}

function generateMockComments(entry: DiaryEntry): AIComment[] {
  const now = Date.now();
  return [
    {
      persona: 'insighter',
      tag: '패턴 발견',
      text: `일기에서 ${entry.body.length > 50 ? '여러 감정들이 교차하는' : '간결하지만 깊은'} 흐름이 느껴져요. 오늘 하루를 이렇게 기록한 것 자체가 의미 있어요.`,
      createdAt: now,
    },
    {
      persona: 'wit',
      tag: '오늘의 위로',
      text: '오늘도 잘 버텼어요. 이 한 줄의 일기가 내일의 당신에게 작은 용기가 될 거예요.',
      createdAt: now + 1,
    },
    {
      persona: 'coach',
      tag: '내일을 위한 제안',
      text: '오늘 느낀 감정 중 가장 강했던 것을 내일 아침에 한 번 더 떠올려보세요. 그 감정이 무엇을 원하는지 들어보면 방향이 보일 거예요.',
      createdAt: now + 2,
    },
  ];
}
