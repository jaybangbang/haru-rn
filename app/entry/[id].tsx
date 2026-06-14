import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { PAL } from '@/constants/palette';
import { AIComment, DiaryEntry, PersonaKey } from '@/lib/types';
import { loadEntries, saveEntry, deleteEntry } from '@/lib/storage';
import { generateSingleComment } from '@/lib/ai';
import EmotionPill from '@/components/EmotionPill';
import {
  ChevronLeftIcon, SparkleIcon, MagnifyIcon, BoltIcon,
  CompassIcon, HeartIcon, CommentIcon,
} from '@/components/Icons';

const PERSONAS = {
  insighter: {
    nameKo: '인사이터',
    handle: '@insighter.ai',
    avatarColors: ['#2D2A5C', '#1B173F'],
    avatarColor: '#F5DCB6',
    accent: '#2D2A5C',
    Icon: MagnifyIcon,
    tag: '패턴 발견',
    likes: 12,
  },
  wit: {
    nameKo: '유머',
    handle: '@wit.ai',
    avatarColors: ['#F7E1B0', '#D9914A'],
    avatarColor: '#3A2A12',
    accent: '#A86A2C',
    Icon: BoltIcon,
    tag: '오늘의 위로',
    likes: 34,
  },
  coach: {
    nameKo: '코치',
    handle: '@coach.ai',
    avatarColors: ['#C8D5B7', '#7A8A66'],
    avatarColor: '#1F2A14',
    accent: '#4A5A38',
    Icon: CompassIcon,
    tag: '내일을 위한 제안',
    likes: 8,
  },
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr / 24)}일 전`;
}

function timeUntil(ts: number): string {
  const diff = ts - Date.now();
  if (diff <= 0) return '곧';
  const min = Math.ceil(diff / 60000);
  if (min < 60) return `${min}분 후`;
  return `${Math.ceil(min / 60)}시간 후`;
}

export default function EntryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [liked, setLiked] = useState<Record<number, boolean>>({});
  const isGenerating = useRef(false);

  const checkAndGenerate = useCallback(async () => {
    if (isGenerating.current) return;

    const all = await loadEntries();
    const e = all.find(x => x.id === id);
    if (!e) return;

    // Always sync display from storage
    setEntry({ ...e });

    const pending = e.pendingComments ?? [];
    const now = Date.now();
    const due = pending.filter(p => p.scheduledAt <= now).sort((a, b) => a.order - b.order);
    if (!due.length) return;

    isGenerating.current = true;
    let current = { ...e, comments: [...e.comments], pendingComments: [...pending] };

    for (const p of due) {
      try {
        const comment = await generateSingleComment(current, p.persona, current.comments);
        current = {
          ...current,
          comments: [...current.comments, comment],
          pendingComments: current.pendingComments!.filter(x => x.scheduledAt !== p.scheduledAt),
        };
        await saveEntry(current);
        setEntry({ ...current });
      } catch {
        // keep pending for next poll
      }
    }

    isGenerating.current = false;
  }, [id]);

  useEffect(() => {
    checkAndGenerate();
    const interval = setInterval(checkAndGenerate, 30_000);
    return () => clearInterval(interval);
  }, [checkAndGenerate]);

  const handleDelete = () => {
    Alert.alert('일기 삭제', '이 일기를 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          if (id) { await deleteEntry(id); router.back(); }
        },
      },
    ]);
  };

  if (!entry) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={{ color: PAL.muted }}>불러오는 중…</Text>
      </View>
    );
  }

  const pending = entry.pendingComments ?? [];
  const nextPending = pending.sort((a, b) => a.scheduledAt - b.scheduledAt)[0];

  // Build flat list: each comment + its replies grouped under it
  // Top-level: replyTo === undefined
  const topLevel = entry.comments
    .map((c, i) => ({ ...c, _idx: i }))
    .filter(c => c.replyTo === undefined);
  const replies = entry.comments
    .map((c, i) => ({ ...c, _idx: i }))
    .filter(c => c.replyTo !== undefined);

  return (
    <View style={{ flex: 1, backgroundColor: PAL.bg }}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 12, paddingBottom: 60 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <ChevronLeftIcon size={22} color={PAL.ink} />
          </Pressable>
          <Text style={styles.topTitle}>Entry</Text>
          <Pressable onPress={handleDelete} hitSlop={8} style={styles.moreBtn}>
            <Text style={{ color: PAL.muted, fontSize: 20, letterSpacing: 2 }}>···</Text>
          </Pressable>
        </View>

        {/* Post card */}
        <View style={styles.postCard}>
          <View style={styles.postHeader}>
            <View style={styles.authorAvatar}>
              <Text style={styles.authorInitials}>나</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.authorName}>나의 일기</Text>
              <Text style={styles.postMeta}>
                {entry.dateObj.y}.{String(entry.dateObj.m).padStart(2, '0')}.{String(entry.dateObj.d).padStart(2, '0')} · {entry.dateObj.dow} · 비공개
              </Text>
            </View>
          </View>

          {entry.emotions.length > 0 && (
            <View style={styles.emotionRow}>
              {entry.emotions.map(em => (
                <EmotionPill key={em.key} emotion={em} size="sm" />
              ))}
            </View>
          )}

          <Text style={styles.bodyText}>{entry.body}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <SparkleIcon size={12} color={PAL.amberDeep} />
              <Text style={styles.statText}>AI {entry.comments.length}명이 읽음</Text>
            </View>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.statText}>{entry.body.length}자</Text>
          </View>
        </View>

        {/* Comments section */}
        <View style={styles.commentsSection}>
          <View style={styles.commentsHeader}>
            <Text style={styles.commentsTitle}>댓글 {entry.comments.length}</Text>
            <Text style={styles.commentsSort}>최신순</Text>
          </View>

          {entry.comments.length === 0 && !nextPending && (
            <View style={styles.noComments}>
              <Text style={styles.noCommentsText}>아직 댓글이 없어요.</Text>
            </View>
          )}

          {/* Render top-level comments and their replies */}
          {topLevel.map(c => {
            const persona = PERSONAS[c.persona];
            if (!persona) return null;
            const myReplies = replies.filter(r => r.replyTo === c._idx);
            return (
              <View key={c._idx}>
                <CommentRow
                  persona={persona}
                  comment={c}
                  liked={!!liked[c._idx]}
                  onLike={() => setLiked(l => ({ ...l, [c._idx]: !l[c._idx] }))}
                  timeAgoStr={timeAgo(c.createdAt)}
                  isReply={false}
                />
                {myReplies.map(r => {
                  const rPersona = PERSONAS[r.persona];
                  if (!rPersona) return null;
                  return (
                    <CommentRow
                      key={r._idx}
                      persona={rPersona}
                      comment={r}
                      liked={!!liked[r._idx]}
                      onLike={() => setLiked(l => ({ ...l, [r._idx]: !l[r._idx] }))}
                      timeAgoStr={timeAgo(r.createdAt)}
                      isReply
                      replyToName={persona.nameKo}
                    />
                  );
                })}
              </View>
            );
          })}

          {/* Orphan replies (replyTo points to a non-top-level comment) */}
          {replies
            .filter(r => topLevel.every(t => t._idx !== r.replyTo))
            .map(r => {
              const rPersona = PERSONAS[r.persona];
              if (!rPersona) return null;
              return (
                <CommentRow
                  key={r._idx}
                  persona={rPersona}
                  comment={r}
                  liked={!!liked[r._idx]}
                  onLike={() => setLiked(l => ({ ...l, [r._idx]: !l[r._idx] }))}
                  timeAgoStr={timeAgo(r.createdAt)}
                  isReply={false}
                />
              );
            })}

          {/* Upcoming comment indicator */}
          {nextPending && (
            <View style={styles.pendingRow}>
              <View style={[styles.pendingDot, { backgroundColor: PERSONAS[nextPending.persona]?.accent ?? PAL.muted }]} />
              <Text style={styles.pendingText}>
                {PERSONAS[nextPending.persona]?.nameKo ?? 'AI'}가 읽는 중…{' '}
                <Text style={styles.pendingTime}>{timeUntil(nextPending.scheduledAt)}</Text>
              </Text>
            </View>
          )}
        </View>

        {/* Reply composer */}
        <View style={styles.replyBox}>
          <View style={styles.replyAvatar}>
            <Text style={styles.replyAvatarText}>나</Text>
          </View>
          <Text style={styles.replyPlaceholder}>AI에게 한 줄 더 물어보기…</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function CommentRow({
  persona, comment, liked, onLike, timeAgoStr, isReply, replyToName,
}: {
  persona: typeof PERSONAS.insighter;
  comment: AIComment & { _idx: number };
  liked: boolean;
  onLike: () => void;
  timeAgoStr: string;
  isReply: boolean;
  replyToName?: string;
}) {
  const tagBg = persona.accent + '1F';
  return (
    <View style={[styles.commentRow, isReply && styles.commentRowReply]}>
      {isReply && <View style={styles.replyConnector} />}
      <View style={[
        styles.commentAvatar,
        { backgroundColor: persona.avatarColors[1] },
        isReply && styles.commentAvatarSmall,
      ]}>
        <persona.Icon size={isReply ? 13 : 17} color={persona.avatarColor} />
      </View>
      <View style={{ flex: 1 }}>
        {isReply && replyToName && (
          <Text style={styles.replyToLabel}>↩ {replyToName}에게 답글</Text>
        )}
        <View style={styles.commentMeta}>
          <Text style={styles.commentName}>{persona.nameKo}</Text>
          <Text style={[styles.commentHandle, { color: persona.accent }]}>{persona.handle}</Text>
          <Text style={styles.commentTime}>· {timeAgoStr}</Text>
          <View style={{ flex: 1 }} />
          <View style={[styles.commentTag, { backgroundColor: tagBg }]}>
            <Text style={[styles.commentTagText, { color: persona.accent }]}>{comment.tag}</Text>
          </View>
        </View>
        <Text style={styles.commentText}>{comment.text}</Text>
        <View style={styles.commentActions}>
          <Pressable onPress={onLike} style={styles.actionBtn}>
            <HeartIcon size={13} color={liked ? PAL.red : PAL.muted} filled={liked} />
            <Text style={[styles.actionText, { color: liked ? PAL.red : PAL.muted }]}>
              {persona.likes + (liked ? 1 : 0)}
            </Text>
          </Pressable>
          <Pressable style={styles.actionBtn}>
            <CommentIcon size={12} color={PAL.muted} />
            <Text style={styles.actionText}>답글</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { paddingHorizontal: 0 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 4,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  topTitle: {
    fontSize: 11, color: PAL.muted,
    letterSpacing: 1.2, textTransform: 'uppercase',
    fontFamily: 'NotoSerifKR-Regular',
  },
  moreBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  postCard: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: PAL.paper,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: PAL.lineSoft,
    overflow: 'hidden',
  },
  postHeader: {
    padding: 16, paddingBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  authorAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: PAL.indigoDeep,
    alignItems: 'center', justifyContent: 'center',
  },
  authorInitials: { color: PAL.bg, fontSize: 14, fontWeight: '500' },
  authorName: { fontSize: 14, fontWeight: '600', color: PAL.ink },
  postMeta: { marginTop: 1, fontSize: 11.5, color: PAL.muted, letterSpacing: 0.1 },
  emotionRow: {
    paddingHorizontal: 16, paddingBottom: 12,
    flexDirection: 'row', gap: 6, flexWrap: 'wrap',
  },
  bodyText: {
    paddingHorizontal: 18, paddingBottom: 16,
    fontFamily: 'NotoSerifKR-Regular',
    fontSize: 16.5, lineHeight: 30,
    color: PAL.ink, letterSpacing: -0.1,
  },
  statsRow: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: PAL.lineSoft,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, color: PAL.muted },
  dot: { fontSize: 12, color: PAL.muted, opacity: 0.5 },
  commentsSection: { paddingHorizontal: 20, marginTop: 24 },
  commentsHeader: {
    flexDirection: 'row', alignItems: 'baseline',
    justifyContent: 'space-between', marginBottom: 14,
    paddingHorizontal: 4,
  },
  commentsTitle: {
    fontSize: 17, fontWeight: '500',
    color: PAL.ink, fontFamily: 'NotoSerifKR-Medium',
  },
  commentsSort: {
    fontSize: 11, color: PAL.muted, letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  noComments: { paddingVertical: 24, alignItems: 'center' },
  noCommentsText: { fontSize: 14, color: PAL.muted, textAlign: 'center', lineHeight: 22 },
  commentRow: {
    flexDirection: 'row', gap: 10,
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: PAL.lineSoft,
  },
  commentRowReply: {
    paddingLeft: 28,
    backgroundColor: PAL.paper + '80',
    borderRadius: 12,
    marginTop: 2,
    borderBottomWidth: 0,
    marginBottom: 4,
  },
  replyConnector: {
    position: 'absolute',
    left: 14, top: 0, bottom: 0,
    width: 1.5,
    backgroundColor: PAL.lineSoft,
  },
  commentAvatar: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  commentAvatarSmall: { width: 28, height: 28, borderRadius: 14 },
  replyToLabel: {
    fontSize: 11, color: PAL.muted, marginBottom: 4, letterSpacing: 0.2,
  },
  commentMeta: {
    flexDirection: 'row', alignItems: 'baseline',
    gap: 4, flexWrap: 'wrap', marginBottom: 6,
  },
  commentName: { fontSize: 13.5, fontWeight: '600', color: PAL.ink },
  commentHandle: { fontSize: 11.5, fontWeight: '500', letterSpacing: 0.2 },
  commentTime: { fontSize: 11, color: PAL.faint },
  commentTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  commentTagText: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  commentText: {
    fontFamily: 'NotoSerifKR-Regular',
    fontSize: 14.5, lineHeight: 24,
    color: PAL.ink, letterSpacing: -0.1,
  },
  commentActions: {
    marginTop: 9, flexDirection: 'row', gap: 16, alignItems: 'center',
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 11.5, color: PAL.muted },
  pendingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 4,
  },
  pendingDot: {
    width: 6, height: 6, borderRadius: 3, opacity: 0.6,
  },
  pendingText: { fontSize: 12.5, color: PAL.muted },
  pendingTime: { color: PAL.faint },
  replyBox: {
    marginHorizontal: 20, marginTop: 18,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 11, paddingHorizontal: 14,
    backgroundColor: PAL.paper,
    borderRadius: 999, borderWidth: 1, borderColor: PAL.line,
  },
  replyAvatar: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: PAL.indigoDeep,
    alignItems: 'center', justifyContent: 'center',
  },
  replyAvatarText: { color: PAL.bg, fontSize: 11, fontWeight: '500' },
  replyPlaceholder: { flex: 1, fontSize: 13, color: PAL.faint },
});
