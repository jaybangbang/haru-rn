import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { PAL } from '@/constants/palette';
import { DiaryEntry, Emotion, EmotionKey } from '@/lib/types';
import { generateId, saveEntry, formatDate, makeDateObj } from '@/lib/storage';
import { generateComments } from '@/lib/ai';
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

export default function WriteScreen() {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [selectedEmotions, setSelectedEmotions] = useState<Emotion[]>([]);
  const [hintIdx, setHintIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<'saving' | 'ai'>('saving');
  const inputRef = useRef<TextInput>(null);

  const now = new Date();
  const dateLabel = `${now.getMonth() + 1}월 ${now.getDate()}일 ${DOW_KO[now.getDay()]}`;

  useEffect(() => {
    const t = setInterval(() => setHintIdx(i => (i + 1) % WRITE_HINTS.length), 3200);
    return () => clearInterval(t);
  }, []);

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
    setSubmitPhase('saving');

    try {
      const date = new Date();
      const entry: DiaryEntry = {
        id: generateId(),
        date: formatDate(date),
        dateObj: makeDateObj(date),
        body: text.trim(),
        preview: text.trim().slice(0, 60) + (text.trim().length > 60 ? '…' : ''),
        emotions: selectedEmotions,
        comments: [],
        createdAt: Date.now(),
      };

      await saveEntry(entry);

      setSubmitPhase('ai');
      const comments = await generateComments(entry);
      entry.comments = comments;
      await saveEntry(entry);

      router.replace(`/entry/${entry.id}`);
    } catch (e) {
      Alert.alert('오류', '저장 중 문제가 발생했어요. 다시 시도해주세요.');
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
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
          <Text style={styles.timeSub}>
            {now.getHours() < 12 ? 'MORNING' : now.getHours() < 18 ? 'AFTERNOON' : 'EVENING'}
          </Text>
        </View>
        <Pressable
          onPress={handleDone}
          disabled={!text.trim() || submitting}
          style={[styles.doneBtn, text.trim() ? styles.doneBtnActive : styles.doneBtnInactive]}
        >
          <Text style={[styles.doneBtnText, { color: text.trim() ? PAL.bg : PAL.faint }]}>
            완료
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Writing area */}
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

        {/* Hint */}
        <Text style={styles.hint}>· {WRITE_HINTS[hintIdx]}</Text>

        {/* Emotion selector */}
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

        {/* Char count */}
        <Text style={styles.charCount}>{text.length} 자</Text>
      </ScrollView>

      {/* AI loading overlay */}
      {submitting && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={PAL.amber} />
          <Text style={styles.overlayTitle}>
            {submitPhase === 'saving' ? '저장 중…' : 'AI가 읽고 있어요…'}
          </Text>
          {submitPhase === 'ai' && (
            <Text style={styles.overlaySub}>세 명이 댓글을 준비 중이에요</Text>
          )}
        </View>
      )}
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
  dateLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: PAL.ink,
    fontFamily: 'NotoSerifKR-Medium',
  },
  timeSub: {
    fontSize: 10.5,
    color: PAL.muted,
    letterSpacing: 0.8,
    marginTop: 2,
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
  hint: {
    marginTop: 14,
    fontSize: 12.5,
    color: PAL.muted,
    letterSpacing: -0.1,
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
});
