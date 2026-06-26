import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Image, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { PAL } from '@/constants/palette';
import { DiaryEntry, PersonaKey, WeeklySummary } from '@/lib/types';
import {
  loadEntries, loadWeeklySummary, saveWeeklySummary, getWeekKey,
} from '@/lib/storage';
import { generateWeeklySummary } from '@/lib/ai';
import { generateWeeklySummary as generateWeeklySummaryV1 } from '@/lib/ai_weekly_v1';
import { generateWeeklySummaryV3 } from '@/lib/ai_weekly_v3';
import { scheduleWeeklySummaryNotification } from '@/lib/notifications';
import { PERSONAS } from '@/lib/personas';
import StreakCard from '@/components/StreakCard';
import { supabase } from '@/lib/supabase';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function getStreakData(entries: DiaryEntry[], savedBest: number = 0) {
  const today = new Date();
  const fmt = (d: Date) =>
    `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  const dates = new Set(entries.map(e => e.date));

  // 오늘 일기 없으면 어제부터 카운트
  const cursor = new Date(today);
  if (!dates.has(fmt(cursor))) cursor.setDate(cursor.getDate() - 1);

  let current = 0;
  const c = new Date(cursor);
  while (dates.has(fmt(c))) { current++; c.setDate(c.getDate() - 1); }

  // StreakCard용 14일 시각 히스토리
  const history: boolean[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    history.push(dates.has(fmt(d)));
  }
  return { current, best: Math.max(current, savedBest), thisYear: entries.length, history };
}

function getWeekLabel(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset * 7);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return `${mon.getMonth() + 1}월 ${mon.getDate()}일 – ${sun.getMonth() + 1}월 ${sun.getDate()}일`;
}

export default function WeeklyScreen() {
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [emptyWeek, setEmptyWeek] = useState(false);
  const [qaLoading, setQaLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'v2' | 'v1' | 'v3'>('v2');
  const [summaryV1, setSummaryV1] = useState<WeeklySummary | null>(null);
  const [loadingV1, setLoadingV1] = useState(false);
  const [summaryV3, setSummaryV3] = useState<WeeklySummary | null>(null);
  const [loadingV3, setLoadingV3] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [streakBest, setStreakBest] = useState(0);

  // 전주 이동 시 즉시 복원용 인메모리 캐시
  const summaryCache = useRef<Record<string, WeeklySummary>>({});
  // 리포트 스크롤 완료 중복 저장 방지
  const hasMarkedRead = useRef(false);

  const weekKey = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return getWeekKey(d);
  }, [weekOffset]);

  const weekLabel = useMemo(() => getWeekLabel(weekOffset), [weekOffset]);

  // 주간 변경 시 리셋 — 캐시 있으면 즉시 복원
  useEffect(() => {
    hasMarkedRead.current = false;
    const hit = summaryCache.current[weekKey + '_v3'];
    setSummaryV3(hit ?? null);
    setSummaryV1(null);
    setSummary(null);
    setDaysLeft(null);
    setLoadError(null);
    setEmptyWeek(false);
  }, [weekKey]);

  const loadData = useCallback(async () => {
    const [all, authResult, savedBestStr] = await Promise.all([
      loadEntries(),
      supabase.auth.getUser(),
      AsyncStorage.getItem('perpetual_streak_best'),
    ]);
    setEntries(all);
    setIsAnonymous(authResult.data.user?.is_anonymous ?? true);

    // 스트리크 최고 기록 영속
    const savedBest = parseInt(savedBestStr ?? '0');
    const dateFmt = (d: Date) =>
      `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    const dateSet = new Set(all.map(e => e.date));
    const cur = new Date();
    if (!dateSet.has(dateFmt(cur))) cur.setDate(cur.getDate() - 1);
    let currentStreak = 0;
    const cc = new Date(cur);
    while (dateSet.has(dateFmt(cc))) { currentStreak++; cc.setDate(cc.getDate() - 1); }
    const newBest = Math.max(currentStreak, savedBest);
    setStreakBest(newBest);
    if (currentStreak > savedBest) {
      AsyncStorage.setItem('perpetual_streak_best', newBest.toString());
    }

    if (all.length === 0) {
      setDaysLeft(7);
      return;
    }

    // 7일 게이트: 현재 주에서만 적용
    if (weekOffset === 0) {
      const firstTs = Math.min(...all.map(e => e.createdAt));
      const elapsed = Date.now() - firstTs;

      if (elapsed < SEVEN_DAYS_MS) {
        const left = Math.ceil((SEVEN_DAYS_MS - elapsed) / (24 * 60 * 60 * 1000));
        setDaysLeft(left);
        scheduleWeeklySummaryNotification(firstTs);
        return;
      }
    }

    setDaysLeft(null);
    setEmptyWeek(false);

    const cached = await loadWeeklySummary(weekKey + '_v3');
    if (cached) {
      summaryCache.current[weekKey + '_v3'] = cached;
      setSummaryV3(cached);
      return;
    }

    // 해당 주 일기 필터 (date 기준)
    const thisWeek = all.filter(e => {
      const [y, m, d] = e.date.split('.').map(Number);
      return getWeekKey(new Date(y, m - 1, d)) === weekKey;
    });

    // 해당 주 일기 없으면 생성 스킵 (weekOffset 무관)
    if (thisWeek.length === 0) {
      setEmptyWeek(true);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const s = await generateWeeklySummaryV3(thisWeek, weekKey + '_v3');
      await saveWeeklySummary(s);
      summaryCache.current[weekKey + '_v3'] = s;
      setSummaryV3(s);
    } catch {
      setLoadError('요약을 불러오는 중 오류가 발생했어요.');
    } finally {
      setLoading(false);
    }
  }, [weekKey, weekOffset]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // 리포트 스크롤 완료 감지 → 가입 전환 트리거용 플래그 저장
  const handleScrollEnd = useCallback(async (nativeEvent: any) => {
    if (!summaryV3 || hasMarkedRead.current) return;
    const { contentOffset, layoutMeasurement, contentSize } = nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 80) {
      hasMarkedRead.current = true;
      await AsyncStorage.setItem('perpetual_weekly_report_read', weekKey);
    }
  }, [summaryV3, weekKey]);

  const handleTabChange = async (tab: 'v2' | 'v1' | 'v3') => {
    setActiveTab(tab);
    if (tab === 'v1' && !summaryV1 && daysLeft === null) {
      const cached = await loadWeeklySummary(weekKey + '_v1');
      if (cached) { setSummaryV1(cached); return; }
      setLoadingV1(true);
      try {
        const thisWeek = entries.filter(e => {
          const [y, m, d] = e.date.split('.').map(Number);
          return getWeekKey(new Date(y, m - 1, d)) === weekKey;
        });
        if (thisWeek.length === 0) return;
        const s = await generateWeeklySummaryV1(thisWeek, weekKey + '_v1');
        await saveWeeklySummary(s);
        setSummaryV1(s);
      } finally {
        setLoadingV1(false);
      }
    }
    if (tab === 'v3' && !summaryV3 && daysLeft === null) {
      const cached = await loadWeeklySummary(weekKey + '_v3');
      if (cached) { setSummaryV3(cached); return; }
      setLoadingV3(true);
      try {
        const thisWeek = entries.filter(e => {
          const [y, m, d] = e.date.split('.').map(Number);
          return getWeekKey(new Date(y, m - 1, d)) === weekKey;
        });
        if (thisWeek.length === 0) { setLoadingV3(false); return; }
        const s = await generateWeeklySummaryV3(thisWeek, weekKey + '_v3');
        await saveWeeklySummary(s);
        setSummaryV3(s);
      } finally {
        setLoadingV3(false);
      }
    }
  };

  const streak = getStreakData(entries, streakBest);
  const hasEnergy = summaryV3?.days.some(d => d.v > 0) ?? false;
  const avgEnergy = summaryV3 && hasEnergy
    ? (summaryV3.days.reduce((s, d) => s + d.v, 0) / Math.max(1, summaryV3.days.filter(d => d.v > 0).length)).toFixed(1)
    : '0.0';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: PAL.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
      onScrollEndDrag={(e) => handleScrollEnd(e.nativeEvent)}
      onMomentumScrollEnd={(e) => handleScrollEnd(e.nativeEvent)}
    >
      {/* 헤더 + 주간 네비게이션 */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>WEEKLY · 주간</Text>
        <View style={styles.headerNav}>
          <Pressable
            onPress={() => setWeekOffset(o => o - 1)}
            style={styles.navBtn}
            hitSlop={10}
          >
            <Text style={styles.navArrow}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>
              {summaryV3?.title ?? (weekOffset === 0 ? '주간 요약' : `${weekLabel.split('–')[0].trim()} 주`)} — {summaryV3?.subtitle ?? '나의 한 주'}
            </Text>
            <Text style={styles.headerSub}>{weekLabel}</Text>
          </View>
          <Pressable
            onPress={() => setWeekOffset(o => Math.min(0, o + 1))}
            style={[styles.navBtn, weekOffset === 0 && styles.navBtnDisabled]}
            disabled={weekOffset === 0}
            hitSlop={10}
          >
            <Text style={[styles.navArrow, weekOffset === 0 && styles.navArrowDisabled]}>›</Text>
          </Pressable>
        </View>
      </View>

      {/* DEV: 즉시 생성 버튼 */}
      {__DEV__ && (
        <View style={styles.devSection}>
          <Text style={styles.devLabel}>🛠 DEV</Text>
          <View style={styles.devRow}>
            <Pressable
              style={[styles.devBtn, loadingV3 && { opacity: 0.5 }]}
              disabled={loadingV3}
              onPress={async () => {
                setLoadingV3(true);
                try {
                  const src = entries.length > 0 ? entries.slice(0, 7) : [];
                  const s = await generateWeeklySummaryV3(src, weekKey + '_v3_qa');
                  await saveWeeklySummary(s);
                  setSummaryV3(s);
                  setDaysLeft(null);
                } finally { setLoadingV3(false); }
              }}
            >
              <Text style={styles.devBtnText}>{loadingV3 ? '생성 중…' : '리포트 즉시 생성'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      <StreakCard streak={streak} />

      {/* 7일 대기 */}
      {daysLeft !== null && (
        <View style={styles.waitCard}>
          <Text style={styles.waitEmoji}>📓</Text>
          <Text style={styles.waitTitle}>
            {daysLeft}일 후에 첫 주간 요약이 준비돼요
          </Text>
          <Text style={styles.waitBody}>
            일기를 쓰기 시작한 지 일주일이 지나면{'\n'}친구들이 한 주를 돌아봐 줄 거예요
          </Text>
        </View>
      )}

      {/* 과거 주 일기 없음 */}
      {emptyWeek && (
        <View style={styles.waitCard}>
          <Text style={styles.waitEmoji}>📅</Text>
          <Text style={styles.waitTitle}>이 주에는 기록이 없어요</Text>
          <Text style={styles.waitBody}>다른 주를 선택해보세요</Text>
        </View>
      )}

      {/* 인라인 리포트 로딩 (전체화면 대신) */}
      {loading && !summaryV3 && daysLeft === null && !emptyWeek && (
        <View style={styles.reportLoadingCard}>
          <ActivityIndicator size="large" color={PAL.amber} />
          <Text style={styles.loadingText}>이번 주 일기를 읽는 중이에요…</Text>
        </View>
      )}

      {/* 에러 상태 */}
      {!loading && !summaryV3 && daysLeft === null && !emptyWeek && loadError && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Pressable style={styles.retryBtn} onPress={loadData}>
            <Text style={styles.retryBtnText}>다시 시도</Text>
          </Pressable>
        </View>
      )}

      {/* 감정 에너지 차트 */}
      {summaryV3 && (
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartLabel}>감정 에너지</Text>
            {hasEnergy && <Text style={styles.chartLabel}>평균 {avgEnergy} / 10</Text>}
          </View>
          {hasEnergy ? (
            <EnergyChart days={summaryV3.days} />
          ) : (
            <EnergyEmptyState />
          )}
        </View>
      )}

      {/* 키워드 */}
      {summaryV3 && summaryV3.keywords.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.keywordsLabel}>이번 주 키워드</Text>
          <KeywordCloud keywords={summaryV3.keywords} />
        </View>
      )}

      {/* 리포트 로딩 */}
      {loadingV3 && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PAL.amber} />
          <Text style={styles.loadingText}>이번 주를 분석하는 중이에요…</Text>
        </View>
      )}

      {/* 리포트 섹션 */}
      {summaryV3 && (
        <>
          {summaryV3.reportHeadline ? (
            <ReportHeadlineCard
              headline={summaryV3.reportHeadline}
              body={summaryV3.reportHeadlineBody ?? ''}
            />
          ) : null}
          {summaryV3.reportPatterns && summaryV3.reportPatterns.length > 0 && (
            <ReportPatternList patterns={summaryV3.reportPatterns} />
          )}
          {summaryV3.reportOpenQuestion ? (
            <ReportOpenQuestionCard question={summaryV3.reportOpenQuestion} />
          ) : null}
          {summaryV3.reportSuggestions && summaryV3.reportSuggestions.length > 0 && (
            <ReportSuggestionList suggestions={summaryV3.reportSuggestions} />
          )}
        </>
      )}

      {/* 클라우드 백업 예고 배너 */}
      <View style={styles.premiumBanner}>
        <Text style={styles.premiumBannerIcon}>☁️</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.premiumBannerText}>클라우드 백업 & 웹 작성</Text>
          <Text style={styles.premiumBannerSub}>곧 열려요 — 지금은 기기에 안전하게 저장돼요</Text>
        </View>
        <View style={styles.comingSoonBadge}>
          <Text style={styles.comingSoonBadgeText}>준비중</Text>
        </View>
      </View>

    </ScrollView>
  );
}

function VersionToggle({ active, onChange }: { active: 'v2' | 'v1' | 'v3'; onChange: (v: 'v2' | 'v1' | 'v3') => void }) {
  return (
    <View style={styles.toggleWrap}>
      <View style={styles.toggle}>
        <Pressable
          onPress={() => onChange('v2')}
          style={[styles.toggleBtn, active === 'v2' && styles.toggleBtnActive]}
        >
          <Text style={[styles.toggleLabel, active === 'v2' && styles.toggleLabelActive]}>
            편지형
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onChange('v1')}
          style={[styles.toggleBtn, active === 'v1' && styles.toggleBtnActive]}
        >
          <Text style={[styles.toggleLabel, active === 'v1' && styles.toggleLabelActive]}>
            카드형
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onChange('v3')}
          style={[styles.toggleBtn, active === 'v3' && styles.toggleBtnActive]}
        >
          <Text style={[styles.toggleLabel, active === 'v3' && styles.toggleLabelActive]}>
            리포트형
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function ReportHeadlineCard({ headline, body }: { headline: string; body: string }) {
  return (
    <View style={styles.reportHeadlineCard}>
      <Text style={styles.reportSectionLabel}>이번 주의 핵심 사건</Text>
      <Text style={styles.reportHeadline}>{headline}</Text>
      {body ? <Text style={styles.reportBody}>{body}</Text> : null}
    </View>
  );
}

function ReportPatternList({ patterns }: { patterns: { title: string; body: string }[] }) {
  const nums = ['①', '②', '③', '④'];
  return (
    <View style={styles.reportSection}>
      <Text style={styles.reportSectionLabel}>반복되는 패턴</Text>
      {patterns.map((p, i) => (
        <View key={i} style={styles.reportItem}>
          <Text style={styles.reportItemNum}>{nums[i] ?? `${i + 1}.`}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.reportItemTitle}>{p.title}</Text>
            {p.body ? <Text style={styles.reportItemBody}>{p.body}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function ReportOpenQuestionCard({ question }: { question: string }) {
  return (
    <View style={styles.reportQuestionCard}>
      <Text style={styles.reportSectionLabel}>가장 중요한 미결 질문</Text>
      <Text style={styles.reportQuestion}>{question}</Text>
    </View>
  );
}

function ReportSuggestionList({ suggestions }: { suggestions: { title: string; body: string }[] }) {
  const nums = ['①', '②', '③', '④'];
  return (
    <View style={styles.reportSection}>
      <Text style={styles.reportSectionLabel}>제언</Text>
      {suggestions.map((s, i) => (
        <View key={i} style={styles.reportItem}>
          <Text style={styles.reportItemNum}>{nums[i] ?? `${i + 1}.`}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.reportItemTitle}>{s.title}</Text>
            {s.body ? <Text style={styles.reportItemBody}>{s.body}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function SuggestionCard({ item }: { item: WeeklySummary['suggestions'][number] }) {
  const p = PERSONAS[item.persona];
  return (
    <View style={[styles.suggCard, { borderLeftColor: p.color }]}>
      <View style={styles.suggHeader}>
        <Image source={p.image} style={styles.suggAvatar} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.suggKind, { color: p.color }]}>{item.kind}</Text>
          <Text style={styles.suggTitle}>{item.title}</Text>
        </View>
        {item.metric && (
          <View style={styles.suggMetricBox}>
            <Text style={styles.suggMetricValue}>{item.metric.value}</Text>
            <Text style={styles.suggMetricLabel}>{item.metric.label}</Text>
          </View>
        )}
      </View>
      <Text style={styles.suggBody}>{item.body}</Text>
    </View>
  );
}

function LetterCard({ persona, text }: { persona: PersonaKey; text: string }) {
  const p = PERSONAS[persona];
  return (
    <View style={styles.letterCard}>
      <View style={styles.letterHeader}>
        <Image source={p.image} style={styles.letterAvatar} />
        <View>
          <Text style={styles.letterName}>{p.name}</Text>
          <Text style={styles.letterRole}>이번 주 일기를 종합해서 정리했어요</Text>
        </View>
      </View>
      <Text style={styles.letterText}>{text}</Text>
    </View>
  );
}

const SAMPLE_ENERGY_DAYS = [
  { d: '월', v: 6 }, { d: '화', v: 4 }, { d: '수', v: 8 },
  { d: '목', v: 5 }, { d: '금', v: 7 }, { d: '토', v: 9 }, { d: '일', v: 6 },
];

function EnergyEmptyState() {
  return (
    <View>
      <View style={{ opacity: 0.25 }}>
        <EnergyChart days={SAMPLE_ENERGY_DAYS} />
      </View>
      <Text style={styles.energyEmptyText}>
        일기 작성 후 감정 에너지를 기록하면{'\n'}여기에 그래프가 표시돼요
      </Text>
    </View>
  );
}

function EnergyChart({ days }: { days: { d: string; v: number }[] }) {
  const W = 320;
  const H = 150;
  const padL = 22, padR = 14, padT = 8, padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const maxV = 10;
  const stepX = innerW / Math.max(1, days.length - 1);
  const peakV = Math.max(...days.map(d => d.v), 1);

  const pts = days.map((d, i) => ({
    x: padL + i * stepX,
    y: padT + innerH - (d.v / maxV) * innerH,
    label: d.d,
    v: d.v,
  }));

  let path = `M ${pts[0]?.x} ${pts[0]?.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }

  const fillPath = pts.length > 0
    ? `${path} L ${pts[pts.length - 1].x} ${padT + innerH} L ${pts[0].x} ${padT + innerH} Z`
    : '';

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <SvgGradient id="fill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={PAL.indigo} stopOpacity={0.32} />
          <Stop offset="100%" stopColor={PAL.indigo} stopOpacity={0.03} />
        </SvgGradient>
      </Defs>
      {[0.25, 0.5, 0.75].map((p, i) => (
        <Line key={i} x1={padL} y1={padT + innerH * p} x2={W - padR} y2={padT + innerH * p}
          stroke={PAL.line} strokeDasharray="2 4" />
      ))}
      {fillPath && <Path d={fillPath} fill="url(#fill)" />}
      {pts.length > 1 && (
        <Path d={path} fill="none" stroke={PAL.indigoDeep} strokeWidth={2.2}
          strokeLinecap="round" strokeLinejoin="round" />
      )}
      {pts.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={3.5}
          fill={PAL.bg} stroke={PAL.indigoDeep} strokeWidth={2} />
      ))}
      {pts.map((p, i) => (
        <SvgText key={i} x={p.x} y={H - 6} textAnchor="middle"
          fill={p.v === peakV ? PAL.amberDeep : PAL.muted}
          fontSize={11} fontWeight={p.v === peakV ? '600' : '400'}>
          {p.label}
        </SvgText>
      ))}
    </Svg>
  );
}

function KeywordCloud({ keywords }: { keywords: { w: string; c: number }[] }) {
  const max = Math.max(...keywords.map(k => k.c), 1);
  return (
    <View style={styles.keywordWrap}>
      {keywords.map((k, i) => {
        const scale = 0.6 + (k.c / max) * 0.7;
        const fs = Math.round(13 + scale * 14);
        const isTop = k.c === max;
        return (
          <Text key={i} style={[styles.keyword, { fontSize: fs, color: isTop ? PAL.indigoDeep : PAL.indigoSoft, fontWeight: isTop ? '600' : '500' }]}>
            {k.w}
            <Text style={styles.keywordCount}>  {k.c}</Text>
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { fontSize: 14, color: PAL.muted, letterSpacing: -0.1 },
  header: { paddingHorizontal: 24, paddingBottom: 8 },
  headerLabel: {
    fontSize: 12, color: PAL.muted, letterSpacing: 1.5,
    textTransform: 'uppercase', fontFamily: 'NotoSerifKR-Regular',
    marginBottom: 10,
  },
  headerNav: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  navBtn: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
  },
  navBtnDisabled: {
    opacity: 0.25,
  },
  navArrow: {
    fontSize: 28, color: PAL.indigoDeep, fontWeight: '300', lineHeight: 32,
  },
  navArrowDisabled: {
    color: PAL.muted,
  },
  headerTitle: {
    fontSize: 20, fontWeight: '500',
    color: PAL.ink, fontFamily: 'NotoSerifKR-Medium',
    letterSpacing: -0.2,
  },
  headerSub: { marginTop: 3, fontSize: 12, color: PAL.muted },
  waitCard: {
    marginHorizontal: 20, marginTop: 20,
    padding: 24, borderRadius: 18,
    backgroundColor: PAL.paper,
    borderWidth: 1, borderColor: PAL.lineSoft,
    alignItems: 'center', gap: 8,
  },
  waitEmoji: { fontSize: 32, marginBottom: 4 },
  waitTitle: {
    fontSize: 16, fontWeight: '600', color: PAL.ink,
    fontFamily: 'NotoSerifKR-Medium', textAlign: 'center',
  },
  waitBody: {
    fontSize: 13, color: PAL.muted, textAlign: 'center',
    lineHeight: 20, marginTop: 4,
  },
  reportLoadingCard: {
    marginHorizontal: 20, marginTop: 20,
    padding: 32, borderRadius: 18,
    backgroundColor: PAL.paper,
    borderWidth: 1, borderColor: PAL.lineSoft,
    alignItems: 'center', gap: 16,
  },
  errorCard: {
    marginHorizontal: 20, marginTop: 20,
    padding: 24, borderRadius: 18,
    backgroundColor: PAL.paper,
    borderWidth: 1, borderColor: PAL.lineSoft,
    alignItems: 'center', gap: 14,
  },
  errorText: {
    fontSize: 14, color: PAL.muted, textAlign: 'center', lineHeight: 22,
  },
  retryBtn: {
    paddingVertical: 10, paddingHorizontal: 20,
    backgroundColor: PAL.indigoDeep, borderRadius: 999,
  },
  retryBtnText: { fontSize: 13, color: '#F5DCB6', fontWeight: '600' },
  qaBtn: {
    marginTop: 16, paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 10, backgroundColor: '#2D2A5C22',
    borderWidth: 1, borderColor: '#2D2A5C44',
  },
  qaBtnText: { fontSize: 13, color: PAL.indigoDeep, fontWeight: '500' },
  chartCard: {
    marginHorizontal: 20, marginTop: 20,
    padding: 16, paddingTop: 20,
    backgroundColor: PAL.paper, borderRadius: 18,
    borderWidth: 1, borderColor: PAL.lineSoft,
  },
  chartHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 4, paddingBottom: 6,
  },
  chartLabel: { fontSize: 11.5, color: PAL.muted, letterSpacing: 0.4 },
  energyEmptyText: {
    fontSize: 12, color: PAL.muted, textAlign: 'center',
    lineHeight: 18, marginTop: 8, paddingHorizontal: 16,
  },
  letterCard: {
    marginHorizontal: 20, marginTop: 18,
    padding: 20, borderRadius: 18,
    backgroundColor: PAL.indigoDeep,
  },
  letterHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, marginBottom: 14,
  },
  letterAvatar: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
  },
  letterName: {
    fontSize: 15, fontWeight: '600', color: '#F5DCB6',
    fontFamily: 'NotoSerifKR-Medium',
  },
  letterRole: {
    fontSize: 11, color: 'rgba(245,220,182,0.6)', marginTop: 2,
  },
  letterText: {
    fontFamily: 'NotoSerifKR-Regular',
    fontSize: 14.5, lineHeight: 26,
    color: '#F4ECDB', letterSpacing: -0.1,
  },
  section: { marginHorizontal: 20, marginTop: 28 },
  keywordsLabel: {
    fontSize: 12, color: PAL.muted,
    letterSpacing: 1.5, textTransform: 'uppercase',
    fontFamily: 'NotoSerifKR-Regular', marginBottom: 12,
  },
  keywordWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'baseline',
  },
  keyword: {
    letterSpacing: -0.2, lineHeight: 22, padding: 4,
  },
  keywordCount: {
    fontSize: 10, color: PAL.amberDeep, fontWeight: '500',
  },
  toggleWrap: {
    paddingHorizontal: 20, marginTop: 16, marginBottom: 4,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: PAL.paper,
    borderRadius: 12,
    borderWidth: 1, borderColor: PAL.lineSoft,
    padding: 3,
  },
  toggleBtn: {
    flex: 1, paddingVertical: 8,
    borderRadius: 10, alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: PAL.indigoDeep,
  },
  toggleLabel: {
    fontSize: 13, fontWeight: '500', color: PAL.muted,
  },
  toggleLabelActive: {
    color: '#F5DCB6',
  },
  v1CommentCard: {
    marginHorizontal: 20, marginTop: 18,
    padding: 20, borderRadius: 18,
    backgroundColor: PAL.paper,
    borderWidth: 1, borderColor: PAL.lineSoft,
  },
  v1CommentLabel: {
    fontSize: 11, color: PAL.muted, letterSpacing: 1.2,
    textTransform: 'uppercase', fontFamily: 'NotoSerifKR-Regular',
    marginBottom: 10,
  },
  v1CommentText: {
    fontFamily: 'NotoSerifKR-Regular',
    fontSize: 14.5, lineHeight: 26,
    color: PAL.ink, letterSpacing: -0.1,
  },
  suggCard: {
    backgroundColor: PAL.paper,
    borderRadius: 16,
    borderWidth: 1, borderColor: PAL.lineSoft,
    borderLeftWidth: 4,
    padding: 16, marginBottom: 12,
  },
  suggHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginBottom: 10,
  },
  suggAvatar: {
    width: 34, height: 34, borderRadius: 17,
  },
  suggKind: {
    fontSize: 10.5, fontWeight: '600',
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginBottom: 2,
  },
  suggTitle: {
    fontSize: 14, fontWeight: '600',
    color: PAL.ink, fontFamily: 'NotoSerifKR-Medium',
  },
  suggMetricBox: {
    alignItems: 'flex-end',
    paddingLeft: 8,
  },
  suggMetricValue: {
    fontSize: 16, fontWeight: '700', color: PAL.indigoDeep,
  },
  suggMetricLabel: {
    fontSize: 10, color: PAL.muted, marginTop: 1,
  },
  suggBody: {
    fontSize: 13.5, lineHeight: 22,
    color: PAL.ink, fontFamily: 'NotoSerifKR-Regular',
  },
  reportHeadlineCard: {
    marginHorizontal: 20, marginTop: 20,
    padding: 20, borderRadius: 18,
    backgroundColor: PAL.paper,
    borderWidth: 1, borderColor: PAL.lineSoft,
  },
  reportSection: {
    marginHorizontal: 20, marginTop: 20,
    padding: 20, borderRadius: 18,
    backgroundColor: PAL.paper,
    borderWidth: 1, borderColor: PAL.lineSoft,
    gap: 14,
  },
  reportQuestionCard: {
    marginHorizontal: 20, marginTop: 20,
    padding: 20, borderRadius: 18,
    backgroundColor: PAL.paper,
    borderWidth: 1.5, borderColor: PAL.amber,
  },
  reportSectionLabel: {
    fontSize: 11, color: PAL.muted, letterSpacing: 1.2,
    textTransform: 'uppercase', fontFamily: 'NotoSerifKR-Regular',
    marginBottom: 10,
  },
  reportHeadline: {
    fontSize: 16, fontWeight: '700', color: PAL.ink,
    fontFamily: 'NotoSerifKR-Medium', letterSpacing: -0.2,
    marginBottom: 8,
  },
  reportBody: {
    fontSize: 14, lineHeight: 24, color: PAL.ink,
    fontFamily: 'NotoSerifKR-Regular', letterSpacing: -0.1,
  },
  reportQuestion: {
    fontSize: 15, fontWeight: '600', color: PAL.amberDeep,
    fontFamily: 'NotoSerifKR-Medium', lineHeight: 24, letterSpacing: -0.2,
  },
  reportItem: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
  },
  reportItemNum: {
    fontSize: 15, color: PAL.indigoDeep, fontWeight: '700',
    marginTop: 1, flexShrink: 0,
  },
  reportItemTitle: {
    fontSize: 14, fontWeight: '600', color: PAL.ink,
    fontFamily: 'NotoSerifKR-Medium', marginBottom: 4, letterSpacing: -0.1,
  },
  reportItemBody: {
    fontSize: 13.5, lineHeight: 22, color: PAL.ink,
    fontFamily: 'NotoSerifKR-Regular',
  },
  devSection: {
    marginHorizontal: 20, marginTop: 28,
    padding: 16, borderRadius: 14,
    backgroundColor: '#2D2A5C11',
    borderWidth: 1, borderColor: '#2D2A5C22',
  },
  devLabel: { fontSize: 11, color: PAL.indigoDeep, fontWeight: '700', marginBottom: 10 },
  devRow: { flexDirection: 'row', gap: 8 },
  devBtn: {
    flex: 1, paddingVertical: 10, alignItems: 'center',
    backgroundColor: PAL.indigoDeep, borderRadius: 10,
  },
  devBtnText: { fontSize: 12, color: '#F5DCB6', fontWeight: '600' },
  premiumBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 20, marginTop: 24, marginBottom: 8,
    padding: 18, borderRadius: 16,
    backgroundColor: PAL.paper,
    borderWidth: 1.5, borderColor: PAL.amberDeep + '55',
  },
  premiumBannerIcon: { fontSize: 24 },
  premiumBannerText: { fontSize: 14, fontWeight: '600', color: PAL.ink },
  premiumBannerSub: { fontSize: 12, color: PAL.muted, marginTop: 3 },
  premiumBannerArrow: { fontSize: 22, color: PAL.amberDeep, fontWeight: '300' },
  comingSoonBadge: {
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: PAL.lineSoft,
    borderRadius: 999,
    borderWidth: 1, borderColor: PAL.line,
  },
  comingSoonBadgeText: { fontSize: 11, color: PAL.muted, fontWeight: '600' },
});
