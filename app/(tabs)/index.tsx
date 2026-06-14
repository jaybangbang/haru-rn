import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { PAL } from '@/constants/palette';
import { DiaryEntry } from '@/lib/types';
import { loadEntries, formatDate, makeDateObj } from '@/lib/storage';
import EntryCard from '@/components/EntryCard';
import { SparkleIcon, PenIcon, ArrowRightIcon } from '@/components/Icons';

const PROMPTS = [
  '🔥 오늘 가장 잘 풀린 일은 무엇이었나요?',
  '💡 오늘 처음 입에서 나온 문장이 있다면?',
  '🎯 이번 주 끝내고 싶은 한 가지는?',
  '✨ 1년 전의 나에게 오늘 한 줄 보낸다면?',
];

const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];

function todayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const date = d.getDate();
  const dow = DOW_KO[d.getDay()];
  return `${y}년 ${m}월 ${date}일 ${dow}요일`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [promptIdx, setPromptIdx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const today = formatDate(new Date());
  const todayEntry = entries.find(e => e.date === today);

  const loadData = useCallback(async () => {
    const all = await loadEntries();
    setEntries(all);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  useEffect(() => {
    const t = setInterval(() => setPromptIdx(i => (i + 1) % PROMPTS.length), 4200);
    return () => clearInterval(t);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const recent = entries.filter(e => e.date !== today).slice(0, 10);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: PAL.bg }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16, paddingBottom: 120 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PAL.amber} />}
    >
      {/* Top bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.appName}>Haru</Text>
          <Text style={styles.dateText}>{todayString()}</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>나</Text>
        </View>
      </View>

      {/* Prompt banner */}
      <Pressable style={styles.promptBanner} onPress={() => router.push('/write')}>
        <SparkleIcon size={20} color={PAL.amberDeep} />
        <View style={{ flex: 1 }}>
          <Text style={styles.promptText}>{PROMPTS[promptIdx]}</Text>
        </View>
        <ArrowRightIcon size={16} color={PAL.amberDeep} />
      </Pressable>

      {/* Today */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>TODAY · {new Date().getMonth() + 1}.{new Date().getDate()}</Text>
        {todayEntry ? (
          <Pressable
            onPress={() => router.push(`/entry/${todayEntry.id}`)}
            style={styles.todayCard}
          >
            <Text style={styles.todayBody} numberOfLines={3}>{todayEntry.body}</Text>
            <View style={styles.todayFooter}>
              {todayEntry.emotions.slice(0, 2).map(em => (
                <Text key={em.key} style={styles.todayEmotion}>{em.emoji} {em.label}</Text>
              ))}
            </View>
          </Pressable>
        ) : (
          <Pressable style={styles.emptyCard} onPress={() => router.push('/write')}>
            <View style={styles.ruledLines} />
            <View style={{ position: 'relative' }}>
              <Text style={styles.emptyTitle}>오늘의 진전을 기록해볼까요.</Text>
              <Text style={styles.emptySub}>짧은 한 줄도 괜찮아요. 내일의 자신이 고마워할 거예요.</Text>
              <View style={styles.writeBtn}>
                <PenIcon size={14} color={PAL.bg} />
                <Text style={styles.writeBtnText}>오늘의 일기 쓰기</Text>
              </View>
            </View>
          </Pressable>
        )}
      </View>

      {/* Recent */}
      {recent.length > 0 && (
        <View style={styles.section}>
          <View style={styles.recentHeader}>
            <Text style={styles.sectionLabel}>RECENT · 최근 일기</Text>
            <Text style={styles.recentCount}>{recent.length} entries</Text>
          </View>
          <View style={styles.entryList}>
            {recent.map(e => (
              <EntryCard key={e.id} entry={e} onPress={() => router.push(`/entry/${e.id}`)} />
            ))}
          </View>
        </View>
      )}

      {entries.length === 0 && (
        <Text style={styles.footer}>— 쓸수록, 나를 알아간다 —</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 0 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 0,
  },
  appName: {
    fontSize: 28,
    fontWeight: '500',
    color: PAL.ink,
    fontFamily: 'NotoSerifKR-Medium',
    letterSpacing: 0.3,
  },
  dateText: {
    marginTop: 6,
    fontSize: 12,
    color: PAL.muted,
    letterSpacing: 0.5,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PAL.indigoDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: PAL.bg,
    fontSize: 14,
    fontWeight: '500',
  },
  promptBanner: {
    marginTop: 22,
    marginHorizontal: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(217,145,74,0.12)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PAL.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  promptText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: PAL.indigoDeep,
    letterSpacing: -0.1,
    lineHeight: 20,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 28,
  },
  sectionLabel: {
    fontSize: 12,
    color: PAL.muted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontFamily: 'NotoSerifKR-Regular',
    marginBottom: 10,
  },
  emptyCard: {
    backgroundColor: PAL.paper,
    borderRadius: 18,
    padding: 28,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: PAL.line,
    overflow: 'hidden',
  },
  ruledLines: {
    position: 'absolute',
    inset: 0,
    opacity: 0.7,
  },
  emptyTitle: {
    fontFamily: 'NotoSerifKR-Regular',
    fontSize: 18,
    fontWeight: '400',
    color: PAL.ink,
    lineHeight: 28,
  },
  emptySub: {
    marginTop: 6,
    fontFamily: 'NotoSerifKR-Regular',
    fontSize: 14,
    color: PAL.muted,
    lineHeight: 22,
  },
  writeBtn: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: PAL.indigoDeep,
  },
  writeBtnText: {
    color: PAL.bg,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  todayCard: {
    backgroundColor: PAL.paper,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: PAL.lineSoft,
  },
  todayBody: {
    fontFamily: 'NotoSerifKR-Regular',
    fontSize: 16,
    lineHeight: 28,
    color: PAL.ink,
  },
  todayFooter: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  todayEmotion: {
    fontSize: 12,
    color: PAL.muted,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  recentCount: {
    fontSize: 12,
    color: PAL.faint,
  },
  entryList: {
    gap: 10,
  },
  footer: {
    marginTop: 32,
    textAlign: 'center',
    fontSize: 12,
    color: PAL.faint,
    fontFamily: 'NotoSerifKR-Regular',
    fontStyle: 'italic',
    letterSpacing: 0.8,
  },
});
