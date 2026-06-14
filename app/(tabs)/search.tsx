import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { PAL, EMOTION_COLOR } from '@/constants/palette';
import { DiaryEntry } from '@/lib/types';
import { loadEntries } from '@/lib/storage';
import { SearchIcon, CloseIcon, CommentIcon } from '@/components/Icons';

const FILTER_EMOTIONS = [
  { key: 'all', label: '전체', emoji: '' },
  { key: 'joy', label: '기쁨', emoji: '😊' },
  { key: 'will', label: '의지', emoji: '💪' },
  { key: 'excited', label: '설렘', emoji: '🔥' },
  { key: 'confident', label: '자신감', emoji: '✨' },
  { key: 'complex', label: '복잡함', emoji: '😤' },
  { key: 'worry', label: '고민', emoji: '💭' },
  { key: 'tired', label: '피곤함', emoji: '😴' },
];

function highlightText(text: string, q: string): { part: string; highlight: boolean }[] {
  if (!q.trim()) return [{ part: text, highlight: false }];
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.split(re).map(p => ({ part: p, highlight: re.test(p) }));
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  useFocusEffect(useCallback(() => {
    loadEntries().then(setEntries);
  }, []));

  const filtered = entries.filter(e => {
    const matchQ = !query.trim() ||
      e.body.toLowerCase().includes(query.toLowerCase()) ||
      e.preview.toLowerCase().includes(query.toLowerCase());
    const matchF = filter === 'all' || e.emotions.some(em => em.key === filter);
    return matchQ && matchF;
  });

  const stats = {
    entries: entries.length,
    comments: entries.reduce((s, e) => s + e.comments.length, 0),
    avgEnergy: entries.length
      ? (entries.reduce((s, e) => s + (e.energyScore ?? 5), 0) / entries.length).toFixed(1)
      : '0.0',
  };

  const recentTopics = Array.from(new Set(
    entries.flatMap(e => e.body.split(/\s+/).filter(w => w.length >= 2)).slice(0, 20)
  )).slice(0, 7);

  return (
    <View style={{ flex: 1, backgroundColor: PAL.bg }}>
      {/* Header + search */}
      <View style={[styles.searchHeader, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerLabel}>SEARCH · 검색</Text>
        <View style={styles.searchBox}>
          <SearchIcon size={18} color={PAL.indigoSoft} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="감정, 키워드, 날짜로 검색"
            placeholderTextColor={PAL.faint}
            style={styles.searchInput}
          />
          {!!query && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <CloseIcon size={16} color={PAL.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroll}
      >
        {FILTER_EMOTIONS.map(f => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              {!!f.emoji && <Text style={styles.filterEmoji}>{f.emoji}</Text>}
              <Text style={[styles.filterLabel, { color: active ? PAL.bg : PAL.ink }]}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
      >
        {/* Empty state */}
        {!query && filter === 'all' && (
          <>
            {recentTopics.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>최근에 자주 쓴 주제</Text>
                <View style={styles.topicWrap}>
                  {recentTopics.map((t, i) => (
                    <Pressable key={i} onPress={() => setQuery(t)} style={styles.topicChip}>
                      <Text style={styles.topicText}>{t}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>이번 달 통계</Text>
              <View style={styles.statsCard}>
                <StatBox n={String(stats.entries)} label="일기" />
                <View style={styles.statDivider} />
                <StatBox n={String(stats.comments)} label="AI 댓글" />
                <View style={styles.statDivider} />
                <StatBox n={stats.avgEnergy} label="평균 에너지" />
              </View>
            </View>
          </>
        )}

        {/* Results */}
        {(!!query || filter !== 'all') && (
          <View style={styles.section}>
            <Text style={styles.resultCount}>
              {filtered.length}개의 결과{query ? ` · "${query}"` : ''}
            </Text>
            {filtered.length === 0 ? (
              <View style={styles.emptyResult}>
                <Text style={styles.emptyResultText}>일치하는 일기가 없어요.</Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {filtered.map(e => (
                  <ResultCard key={e.id} entry={e} query={query} onPress={() => router.push(`/entry/${e.id}`)} />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StatBox({ n, label }: { n: string; label: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statNum}>{n}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ResultCard({ entry, query, onPress }: { entry: DiaryEntry; query: string; onPress: () => void }) {
  const parts = highlightText(entry.preview, query);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.resultCard, pressed && { opacity: 0.85 }]}>
      <View style={styles.resultHeader}>
        <Text style={styles.resultDate}>{entry.date} · {entry.dateObj.dow}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <CommentIcon size={11} color={PAL.amberDeep} />
          <Text style={styles.resultCommentCount}>{entry.comments?.length || 0}</Text>
        </View>
      </View>
      <Text style={styles.resultBody} numberOfLines={2}>
        {parts.map((p, i) => (
          <Text key={i} style={p.highlight ? styles.highlight : undefined}>{p.part}</Text>
        ))}
      </Text>
      {entry.emotions.length > 0 && (
        <View style={styles.resultEmotions}>
          {entry.emotions.map(em => (
            <Text key={em.key} style={styles.resultEmotion}>{em.emoji} {em.label}</Text>
          ))}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  searchHeader: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: PAL.bg,
  },
  headerLabel: {
    fontSize: 12, color: PAL.muted, letterSpacing: 1.5,
    textTransform: 'uppercase', fontFamily: 'NotoSerifKR-Regular',
    marginBottom: 10,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 11, paddingHorizontal: 14,
    backgroundColor: PAL.paper, borderRadius: 14,
    borderWidth: 1, borderColor: PAL.line,
  },
  searchInput: {
    flex: 1, fontSize: 14, color: PAL.ink,
    letterSpacing: -0.1,
    fontFamily: 'NotoSansKR-Regular',
  },
  filterScroll: { flexGrow: 0 },
  filterRow: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 8,
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 7, paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1, borderColor: PAL.line,
    backgroundColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: PAL.indigoDeep,
    borderColor: PAL.indigoDeep,
  },
  filterEmoji: { fontSize: 13 },
  filterLabel: { fontSize: 12.5, fontWeight: '500', letterSpacing: -0.1 },
  content: { paddingHorizontal: 20, paddingBottom: 120 },
  section: { marginBottom: 28 },
  sectionLabel: {
    fontSize: 11.5, color: PAL.muted, letterSpacing: 1.2,
    textTransform: 'uppercase', fontFamily: 'NotoSerifKR-Regular',
    marginBottom: 12,
  },
  topicWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  topicChip: {
    paddingVertical: 8, paddingHorizontal: 13,
    borderRadius: 999, backgroundColor: PAL.paper,
    borderWidth: 1, borderColor: PAL.line,
  },
  topicText: {
    fontFamily: 'NotoSerifKR-Regular',
    fontSize: 13.5, fontWeight: '500', color: PAL.ink,
  },
  statsCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: PAL.paper, borderRadius: 14,
    borderWidth: 1, borderColor: PAL.lineSoft,
    padding: 16,
  },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  statNum: {
    fontSize: 24, fontWeight: '500',
    color: PAL.indigoDeep, letterSpacing: -0.2, lineHeight: 28,
  },
  statLabel: { marginTop: 5, fontSize: 11, color: PAL.muted, letterSpacing: 0.2 },
  statDivider: { width: 1, height: 36, backgroundColor: PAL.line },
  resultCount: { fontSize: 11.5, color: PAL.muted, letterSpacing: 0.5, marginBottom: 10 },
  emptyResult: { paddingVertical: 40, alignItems: 'center' },
  emptyResultText: { fontSize: 14, color: PAL.muted },
  resultCard: {
    backgroundColor: PAL.paper, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: PAL.lineSoft,
  },
  resultHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6,
  },
  resultDate: { fontSize: 12, color: PAL.muted, letterSpacing: 0.4 },
  resultCommentCount: { fontSize: 11, color: PAL.amberDeep, fontWeight: '500' },
  resultBody: {
    fontFamily: 'NotoSerifKR-Regular',
    fontSize: 14, lineHeight: 22, color: PAL.ink,
  },
  highlight: {
    backgroundColor: 'rgba(217,145,74,0.32)',
    color: PAL.indigoDeep, fontWeight: '600',
  },
  resultEmotions: {
    flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginTop: 8,
  },
  resultEmotion: { fontSize: 10.5, color: PAL.muted },
});
