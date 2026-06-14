import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient as SvgGradient, Stop, ClipPath, Rect } from 'react-native-svg';
import { PAL } from '@/constants/palette';
import { DiaryEntry, WeeklySummary } from '@/lib/types';
import {
  loadEntries, loadWeeklySummary, saveWeeklySummary, getWeekKey,
} from '@/lib/storage';
import { generateWeeklySummary } from '@/lib/ai';
import StreakCard from '@/components/StreakCard';
import SuggestionCard from '@/components/SuggestionCard';
import { MagnifyIcon } from '@/components/Icons';

function getStreakData(entries: DiaryEntry[]) {
  const today = new Date();
  const history: boolean[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    history.push(entries.some(e => e.date === dateStr));
  }
  let current = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]) current++;
    else break;
  }
  const best = Math.max(current, 1);
  return { current, best, thisYear: entries.length, history };
}

export default function WeeklyScreen() {
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const weekKey = getWeekKey();

  const loadData = useCallback(async () => {
    const all = await loadEntries();
    setEntries(all);

    const cached = await loadWeeklySummary(weekKey);
    if (cached) {
      setSummary(cached);
      return;
    }

    const thisWeek = all.filter(e => {
      const created = new Date(e.createdAt);
      return getWeekKey(created) === weekKey;
    });

    setLoading(true);
    try {
      const s = await generateWeeklySummary(thisWeek, weekKey);
      await saveWeeklySummary(s);
      setSummary(s);
    } finally {
      setLoading(false);
    }
  }, [weekKey]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const streak = getStreakData(entries);
  const avgEnergy = summary
    ? (summary.days.reduce((s, d) => s + d.v, 0) / Math.max(1, summary.days.filter(d => d.v > 0).length)).toFixed(1)
    : '0.0';

  if (loading && !summary) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={PAL.amber} />
        <Text style={styles.loadingText}>이번 주 일기를 분석 중이에요…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: PAL.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.headerLabel}>WEEKLY · 주간</Text>
        <Text style={styles.headerTitle}>{summary?.title ?? '주간 요약'} — {summary?.subtitle ?? '나의 한 주'}</Text>
        <Text style={styles.headerSub}>{summary?.dateRange ?? '로드 중…'}</Text>
      </View>

      <StreakCard streak={streak} />

      {/* Chart */}
      {summary && (
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartLabel}>감정 에너지</Text>
            <Text style={styles.chartLabel}>평균 {avgEnergy} / 10</Text>
          </View>
          <EnergyChart days={summary.days} />
        </View>
      )}

      {/* AI comment */}
      {summary?.comment && (
        <View style={styles.aiCommentCard}>
          <View style={styles.aiCommentHeader}>
            <MagnifyIcon size={14} color="#F5DCB6" />
            <Text style={styles.aiCommentTitle}>Insighter · 이번 주의 발견</Text>
          </View>
          <Text style={styles.aiCommentText}>{summary.comment}</Text>
        </View>
      )}

      {/* Suggestions */}
      {summary && summary.suggestions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>AI의 제언</Text>
            <Text style={styles.sectionCount}>{summary.suggestions.length}개의 인사이트</Text>
          </View>
          <Text style={styles.sectionSub}>이번 주 일기를 종합해서 정리했어요</Text>
          <View style={{ gap: 10 }}>
            {summary.suggestions.map((s, i) => (
              <SuggestionCard key={i} s={s} />
            ))}
          </View>
        </View>
      )}

      {/* Keywords */}
      {summary && summary.keywords.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.keywordsLabel}>이번 주 키워드</Text>
          <KeywordCloud keywords={summary.keywords} />
        </View>
      )}
    </ScrollView>
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
  },
  headerTitle: {
    marginTop: 6, fontSize: 26, fontWeight: '500',
    color: PAL.ink, fontFamily: 'NotoSerifKR-Medium',
    letterSpacing: -0.2,
  },
  headerSub: { marginTop: 4, fontSize: 12, color: PAL.muted },
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
  aiCommentCard: {
    marginHorizontal: 20, marginTop: 18,
    padding: 18, borderRadius: 18,
    backgroundColor: PAL.indigoDeep,
  },
  aiCommentHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 10,
  },
  aiCommentTitle: {
    fontSize: 13, fontWeight: '600',
    letterSpacing: 0.5, textTransform: 'uppercase',
    color: '#F5DCB6',
  },
  aiCommentText: {
    fontFamily: 'NotoSerifKR-Regular',
    fontSize: 14.5, lineHeight: 26,
    color: '#F4ECDB', letterSpacing: -0.1,
  },
  section: { marginHorizontal: 20, marginTop: 28 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'baseline',
    justifyContent: 'space-between', marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18, fontWeight: '500',
    color: PAL.ink, fontFamily: 'NotoSerifKR-Medium',
  },
  sectionCount: {
    fontSize: 11, color: PAL.faint, letterSpacing: 0.5,
  },
  sectionSub: {
    fontSize: 12, color: PAL.muted, marginBottom: 14,
  },
  keywordsLabel: {
    fontSize: 12, color: PAL.muted,
    letterSpacing: 1.5, textTransform: 'uppercase',
    fontFamily: 'NotoSerifKR-Regular', marginBottom: 12,
  },
  keywordWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'baseline',
  },
  keyword: {
    letterSpacing: -0.2, lineHeight: 22,
    padding: 4,
  },
  keywordCount: {
    fontSize: 10, color: PAL.amberDeep, fontWeight: '500',
  },
});
