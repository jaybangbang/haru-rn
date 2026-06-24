import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Alert, ActivityIndicator, Modal, SafeAreaView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { PAL } from '@/constants/palette';
import { DiaryEntry, Emotion, EmotionKey } from '@/lib/types';
import { generateId, saveEntry, formatDate, makeDateObj, getWeekKey } from '@/lib/storage';
import { schedulePendingComments } from '@/lib/ai';
import { scheduleCommentNotification } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { CloseIcon, MicIcon } from '@/components/Icons';

const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];
const WRITE_HINTS = [
  '오늘 어떤 감정이 가장 컸나요?',
  '오늘 가장 오래 생각한 건 무엇인가요?',
  '내일의 나에게 한마디 남긴다면?',
  '오늘 사소했지만 좋았던 순간은?',
];

const EMOTION_OPTIONS: Emotion[] = [
  { key: 'joy', label: '기쁨', emoji: '😊' },
  { key: 'will', label: '의지', emoji: '💪' },
  { key: 'excited', label: '설렘', emoji: '🔥' },
  { key: 'confident', label: '자신감', emoji: '✨' },
  { key: 'complex', label: '복잡함', emoji: '😤' },
  { key: 'worry', label: '고민', emoji: '💭' },
  { key: 'tired', label: '피곤함', emoji: '😴' },
];

function makeDateLabel(d: Date) {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${DOW_KO[d.getDay()]}`;
}

function isToday(d: Date) {
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

export default function WriteScreen() {
  const insets = useSafeAreaInsets();
  const { date: dateParam, entryId, topic: topicParam } = useLocalSearchParams<{ date?: string; entryId?: string; topic?: string }>();
  const isEditMode = !!entryId;
  const [text, setText] = useState('');
  const [selectedEmotions, setSelectedEmotions] = useState<Emotion[]>([]);
  const [topic, setTopic] = useState<string | undefined>(topicParam ?? undefined);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (dateParam) {
      const [y, m, d] = dateParam.split('.').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  });
  const [showPicker, setShowPicker] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const savedEntryId = useRef<string | null>(null);
  const existingEntryRef = useRef<DiaryEntry | null>(null);
  const inputRef = useRef<TextInput>(null);

  const now = new Date();
  const dateLabel = makeDateLabel(selectedDate);
  const isPast = !isToday(selectedDate);

  // 수정 모드: 기존 데이터 로드
  useEffect(() => {
    if (!isEditMode) return;
    (async () => {
      const { loadEntries } = await import('@/lib/storage');
      const all = await loadEntries();
      const found = all.find(e => e.id === entryId);
      if (found) {
        existingEntryRef.current = found;
        setText(found.body);
        setSelectedEmotions(found.emotions);
        if (found.topic) setTopic(found.topic);
        const [y, m, d] = found.date.split('.').map(Number);
        setSelectedDate(new Date(y, m - 1, d));
      }
    })();
  }, [entryId, isEditMode]);


  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  const toggleEmotion = (em: Emotion) => {
    setSelectedEmotions(prev => {
      const has = prev.some(e => e.key === em.key);
      if (has) return prev.filter(e => e.key !== em.key);
      if (prev.length >= 3) return prev;
      return [...prev, em];
    });
  };

  const handleDone = async () => {
    if (!text.trim()) return;
    setSubmitting(true);

    try {
      const trimmed = text.trim();
      const preview = trimmed.slice(0, 60) + (trimmed.length > 60 ? '…' : '');

      if (isEditMode && existingEntryRef.current) {
        // 수정 모드: AI 댓글 유지, 새 댓글 예약 안 함
        const updated: DiaryEntry = {
          ...existingEntryRef.current,
          date: formatDate(selectedDate),
          dateObj: makeDateObj(selectedDate),
          body: trimmed,
          preview,
          emotions: selectedEmotions,
          topic,
        };
        await saveEntry(updated);
        router.back();
        return;
      }

      // 신규 작성
      const ts = Date.now();
      const newId = generateId();
      const pending = schedulePendingComments(ts);

      const pendingWithNotifs = await Promise.all(
        pending.map(async p => {
          const notifId = await scheduleCommentNotification(newId, p.persona, p.scheduledAt, preview);
          return { ...p, notifId: notifId ?? undefined };
        }),
      );

      const entry: DiaryEntry = {
        id: newId,
        date: formatDate(selectedDate),
        dateObj: makeDateObj(selectedDate),
        body: trimmed,
        preview,
        emotions: selectedEmotions,
        comments: [],
        pendingComments: pendingWithNotifs,
        topic,
        createdAt: ts,
      };

      await saveEntry(entry);

      // 주간 리포트 스크롤 완료 후 다음 주 일기 작성 시 회원가입 유도
      const reportReadKey = await AsyncStorage.getItem('perpetual_weekly_report_read');
      if (reportReadKey) {
        const currentWeekKey = getWeekKey(new Date());
        if (reportReadKey < currentWeekKey) {
          const dismissed = await AsyncStorage.getItem('perpetual_auth_banner_dismissed');
          if (!dismissed) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.is_anonymous) {
              savedEntryId.current = entry.id;
              setShowAuthPrompt(true);
              setSubmitting(false);
              return;
            }
          }
        }
      }

      router.replace(`/entry/${entry.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      Alert.alert('오류', msg);
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: PAL.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn} hitSlop={8}>
          <CloseIcon size={22} color={PAL.ink} />
        </Pressable>
        <Pressable onPress={() => setShowPicker(v => !v)} style={styles.dateCenter}>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
          <Text style={styles.timeSub}>
            {isEditMode ? '수정 중' : isPast ? '과거 일기 작성 중' : now.getHours() < 12 ? 'MORNING' : now.getHours() < 18 ? 'AFTERNOON' : 'EVENING'}
          </Text>
        </Pressable>
        <Pressable
          onPress={handleDone}
          disabled={!text.trim() || submitting}
          style={[styles.doneBtn, text.trim() ? styles.doneBtnActive : styles.doneBtnInactive]}
        >
          <Text style={[styles.doneBtnText, { color: text.trim() ? PAL.bg : PAL.faint }]}>
            {isEditMode ? '수정' : '완료'}
          </Text>
        </Pressable>
      </View>

      {/* Date picker */}
      {showPicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="spinner"
          maximumDate={new Date()}
          locale="ko-KR"
          onChange={(_, date) => {
            if (date) setSelectedDate(date);
          }}
          style={styles.datePicker}
        />
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {topic ? (
          <View style={styles.topicTag}>
            <Text style={styles.topicTagText} numberOfLines={1}>{topic}</Text>
            <Pressable onPress={() => setTopic(undefined)} hitSlop={8}>
              <Text style={styles.topicTagX}>✕</Text>
            </Pressable>
          </View>
        ) : null}

        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          multiline
          placeholder="오늘의 한 줄을 적어보세요…"
          placeholderTextColor={PAL.faint}
          style={styles.textInput}
          textAlignVertical="top"
          scrollEnabled={false}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hintRow}
          style={styles.hintScroll}
          keyboardShouldPersistTaps="handled"
        >
          {WRITE_HINTS.map((h, i) => (
            <Pressable
              key={i}
              style={[styles.hintChip, topic === h && styles.hintChipActive]}
              onPress={() => setTopic(prev => prev === h ? undefined : h)}
            >
              <Text style={[styles.hintChipText, topic === h && styles.hintChipTextActive]}>{h}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.emotionSection}>
          <Text style={styles.emotionLabel}>오늘의 감정</Text>
          <View style={styles.emotionGrid}>
            {EMOTION_OPTIONS.map(em => {
              const active = selectedEmotions.some(e => e.key === em.key);
              return (
                <Pressable
                  key={em.key}
                  onPress={() => toggleEmotion(em)}
                  style={[styles.emotionChip, active && styles.emotionChipActive]}
                >
                  <Text style={styles.emotionEmoji}>{em.emoji}</Text>
                  <Text style={[styles.emotionChipText, { color: active ? PAL.indigoDeep : PAL.muted }]}>
                    {em.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={styles.charCount}>{text.length} 자</Text>
      </ScrollView>

      {submitting && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={PAL.amber} />
          <Text style={styles.overlayTitle}>저장 중…</Text>
          <View style={{ height: 0 }} />
        </View>
      )}

      {/* 회원가입 유도 전체화면 */}
      <Modal visible={showAuthPrompt} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={styles.authModal}>
          <View style={styles.authModalInner}>
            <View style={styles.authIconCircle}>
              <Text style={{ fontSize: 36 }}>📖</Text>
            </View>

            <Text style={styles.authModalHeadline}>
              오늘 쓴 일기,{'\n'}내일도 읽을 수 있게.
            </Text>
            <Text style={styles.authModalBody}>
              지금은 이 기기에만 저장돼요.{'\n'}계정을 만들면 기기를 바꿔도, 앱을 지워도{'\n'}일기가 그대로 남아있어요.
            </Text>

            <View style={styles.authFeatureRow}>
              <View style={styles.authFeaturePill}>
                <Text style={styles.authFeatureIcon}>🌐</Text>
                <Text style={styles.authFeatureText}>웹에서도 작성</Text>
              </View>
              <View style={styles.authFeaturePill}>
                <Text style={styles.authFeatureIcon}>🔄</Text>
                <Text style={styles.authFeatureText}>기기 간 동기화</Text>
              </View>
              <View style={styles.authFeaturePill}>
                <Text style={styles.authFeatureIcon}>🔒</Text>
                <Text style={styles.authFeatureText}>안전하게 보관</Text>
              </View>
            </View>

            <View style={styles.authModalActions}>
              <Pressable
                style={styles.authModalPrimary}
                onPress={() => {
                  setShowAuthPrompt(false);
                  router.replace('/auth');
                }}
              >
                <Text style={styles.authModalPrimaryText}>계정 만들기</Text>
              </Pressable>
              <Pressable
                style={styles.authModalSecondary}
                onPress={async () => {
                  await AsyncStorage.setItem('perpetual_auth_banner_dismissed', '1');
                  setShowAuthPrompt(false);
                  if (savedEntryId.current) router.replace(`/entry/${savedEntryId.current}`);
                }}
              >
                <Text style={styles.authModalSecondaryText}>나중에 할게요</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 8,
    backgroundColor: PAL.bg,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCenter: {
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: PAL.ink,
    fontFamily: 'NotoSerifKR-Medium',
    borderBottomWidth: 1,
    borderBottomColor: PAL.line,
    paddingBottom: 1,
  },
  timeSub: {
    fontSize: 10.5,
    color: PAL.muted,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  datePicker: {
    backgroundColor: PAL.bg,
  },
  doneBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  doneBtnActive: {
    backgroundColor: PAL.indigoDeep,
  },
  doneBtnInactive: {
    borderWidth: 1,
    borderColor: PAL.line,
  },
  doneBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    padding: 24,
    paddingBottom: 60,
  },
  textInput: {
    fontFamily: 'NotoSerifKR-Regular',
    fontSize: 17,
    lineHeight: 31,
    color: PAL.ink,
    letterSpacing: -0.1,
    minHeight: 240,
    backgroundColor: 'transparent',
  },
  topicTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(217,145,74,0.14)',
    borderWidth: 1,
    borderColor: PAL.amberDeep + '55',
    borderRadius: 999,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
    marginBottom: 14,
    gap: 8,
    maxWidth: '100%',
  },
  topicTagText: {
    fontSize: 13,
    color: PAL.amberDeep,
    fontWeight: '500',
    fontFamily: 'NotoSerifKR-Regular',
    flexShrink: 1,
  },
  topicTagX: {
    fontSize: 12,
    color: PAL.amberDeep,
    fontWeight: '600',
    opacity: 0.7,
  },
  hintScroll: {
    marginTop: 14,
  },
  hintRow: {
    gap: 8,
    paddingRight: 8,
  },
  hintChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PAL.line,
    backgroundColor: 'transparent',
  },
  hintChipActive: {
    backgroundColor: 'rgba(217,145,74,0.14)',
    borderColor: PAL.amberDeep + '55',
  },
  hintChipText: {
    fontSize: 12,
    color: PAL.muted,
    letterSpacing: -0.1,
  },
  hintChipTextActive: {
    color: PAL.amberDeep,
    fontWeight: '500',
  },
  emotionSection: {
    marginTop: 28,
  },
  emotionLabel: {
    fontSize: 12,
    color: PAL.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
    fontFamily: 'NotoSerifKR-Regular',
  },
  emotionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emotionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PAL.line,
    backgroundColor: 'transparent',
  },
  emotionChipActive: {
    backgroundColor: 'rgba(45,42,92,0.10)',
    borderColor: 'rgba(45,42,92,0.30)',
  },
  emotionEmoji: {
    fontSize: 15,
  },
  emotionChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  charCount: {
    marginTop: 20,
    fontSize: 11,
    color: PAL.faint,
    textAlign: 'right',
  },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(31,27,58,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  overlayTitle: {
    color: PAL.bg,
    fontSize: 20,
    fontFamily: 'NotoSerifKR-Regular',
    letterSpacing: -0.2,
  },
  overlaySub: {
    color: 'rgba(244,236,219,0.6)',
    fontSize: 12.5,
    letterSpacing: 0.4,
  },
  authModal: { flex: 1, backgroundColor: PAL.indigoDeep },
  authModalInner: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, paddingBottom: 40,
  },
  authIconCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 32,
  },
  authModalHeadline: {
    fontSize: 28, fontWeight: '600', color: PAL.bg,
    fontFamily: 'NotoSerifKR-Medium',
    textAlign: 'center', lineHeight: 42, marginBottom: 16,
  },
  authModalBody: {
    fontSize: 15, color: 'rgba(255,255,255,0.65)',
    textAlign: 'center', lineHeight: 24, marginBottom: 32,
  },
  authFeatureRow: {
    flexDirection: 'row', gap: 10, marginBottom: 48,
    flexWrap: 'wrap', justifyContent: 'center',
  },
  authFeaturePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  authFeatureIcon: { fontSize: 14 },
  authFeatureText: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  authModalActions: { width: '100%', gap: 12 },
  authModalPrimary: {
    backgroundColor: PAL.bg, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
  },
  authModalPrimaryText: {
    fontSize: 16, fontWeight: '700', color: PAL.indigoDeep, letterSpacing: -0.3,
  },
  authModalSecondary: { paddingVertical: 14, alignItems: 'center' },
  authModalSecondaryText: { fontSize: 14, color: 'rgba(255,255,255,0.45)' },
});
