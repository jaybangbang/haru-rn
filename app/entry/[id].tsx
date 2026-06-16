import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Alert, Image,
  TextInput, KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { PAL } from '@/constants/palette';
import { AIComment, DiaryEntry, PersonaKey } from '@/lib/types';
import { loadEntries, saveEntry, deleteEntry } from '@/lib/storage';
import { generateSingleComment, generateUserReply } from '@/lib/ai';
import { cancelNotification, notifyCommentReady } from '@/lib/notifications';
import { PERSONAS as PERSONA_PROFILES } from '@/lib/personas';
import EmotionPill from '@/components/EmotionPill';
import {
  ChevronLeftIcon, SparkleIcon, HeartIcon, CommentIcon, PenIcon, SendIcon, CloseIcon,
} from '@/components/Icons';

const PERSONA_META = {
  insighter: { handle: '@siwon',   accent: '#2D2A5C' },
  wit:       { handle: '@hakyung', accent: '#A86A2C' },
  coach:     { handle: '@seojin',  accent: '#4A5A38' },
} as const;

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
  const [showMenu, setShowMenu] = useState(false);
  const [replyTarget, setReplyTarget] = useState<{ personaKey: PersonaKey; parentIdx: number } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const isGenerating = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  // Persist likes per entry
  const likesKey = `haru_likes_${id}`;

  const loadLikes = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(likesKey);
      if (raw) setLiked(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [likesKey]);

  const toggleLike = useCallback(async (idx: number) => {
    setLiked(prev => {
      const next = { ...prev, [idx]: !prev[idx] };
      AsyncStorage.setItem(likesKey, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [likesKey]);

  const checkAndGenerate = useCallback(async () => {
    if (isGenerating.current) return;

    const all = await loadEntries();
    const e = all.find(x => x.id === id);
    if (!e) return;

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
        if (p.notifId) await cancelNotification(p.notifId);

        if (comment === null) {
          // Persona chose to skip (e.g. 박서진 with no career content)
          current = {
            ...current,
            pendingComments: current.pendingComments!.filter(x => x.scheduledAt !== p.scheduledAt),
          };
        } else {
          await notifyCommentReady(current.id, p.persona, comment.text);
          current = {
            ...current,
            comments: [...current.comments, comment],
            pendingComments: current.pendingComments!.filter(x => x.scheduledAt !== p.scheduledAt),
          };
        }
        await saveEntry(current);
        setEntry({ ...current });
      } catch {
        // keep pending for next poll
      }
    }

    isGenerating.current = false;
  }, [id]);

  useEffect(() => {
    checkAndGenerate().catch(() => {});
    loadLikes();
    const interval = setInterval(() => checkAndGenerate().catch(() => {}), 30_000);
    return () => clearInterval(interval);
  }, [checkAndGenerate, loadLikes]);

  const handleDelete = () => {
    setShowMenu(false);
    Alert.alert('일기 삭제', '이 일기를 영구 삭제할까요? 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          if (id) { await deleteEntry(id); router.back(); }
        },
      },
    ]);
  };

  const handleReplyPress = (personaKey: PersonaKey, parentIdx: number) => {
    setReplyTarget({ personaKey, parentIdx });
    setTimeout(() => {
      inputRef.current?.focus();
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleCancelReply = () => {
    setReplyTarget(null);
    setReplyText('');
    Keyboard.dismiss();
  };

  const handleSubmitReply = async () => {
    if (!replyTarget || !replyText.trim() || !entry || isReplying) return;

    const text = replyText.trim();
    setReplyText('');
    setIsReplying(true);
    Keyboard.dismiss();

    // Add user comment
    const userComment: AIComment = {
      persona: replyTarget.personaKey,
      isUser: true,
      replyTo: replyTarget.parentIdx,
      text,
      createdAt: Date.now(),
    };

    const withUser = { ...entry, comments: [...entry.comments, userComment] };
    setEntry(withUser);
    await saveEntry(withUser);

    // Generate AI response
    try {
      const threadHistory = withUser.comments.filter(
        (c, i) => i === replyTarget.parentIdx || c.replyTo === replyTarget.parentIdx
      );
      const aiReply = await generateUserReply(
        entry,
        replyTarget.personaKey,
        text,
        threadHistory,
      );
      aiReply.replyTo = replyTarget.parentIdx;
      const withAI = { ...withUser, comments: [...withUser.comments, aiReply] };
      setEntry(withAI);
      await saveEntry(withAI);
    } catch { /* keep user comment, AI reply failed silently */ }

    setReplyTarget(null);
    setIsReplying(false);
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

  // AI top-level comments (not user, no replyTo)
  const topLevel = entry.comments
    .map((c, i) => ({ ...c, _idx: i }))
    .filter(c => !c.isUser && c.replyTo === undefined);

  // All replies (AI or user)
  const allReplies = entry.comments
    .map((c, i) => ({ ...c, _idx: i }))
    .filter(c => c.replyTo !== undefined);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: PAL.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 12, paddingBottom: 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <ChevronLeftIcon size={22} color={PAL.ink} />
          </Pressable>
          <Text style={styles.topTitle}>Entry</Text>
          <View style={styles.topActions}>
            <Pressable
              onPress={() => router.push({ pathname: '/write', params: { entryId: id } })}
              hitSlop={8} style={styles.editBtn}
            >
              <PenIcon size={18} color={PAL.muted} />
            </Pressable>
            <Pressable onPress={() => setShowMenu(v => !v)} hitSlop={8} style={styles.moreBtn}>
              <Text style={{ color: PAL.muted, fontSize: 20, letterSpacing: 2 }}>···</Text>
            </Pressable>
          </View>
        </View>

        {/* Dropdown menu */}
        {showMenu && (
          <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
            <View style={styles.menuBox}>
              <Pressable style={styles.menuItem} onPress={handleDelete}>
                <Text style={styles.menuItemTextDanger}>삭제</Text>
              </Pressable>
            </View>
          </Pressable>
        )}

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
              <Text style={styles.statText}>AI {entry.comments.filter(c => !c.isUser).length}명이 읽음</Text>
            </View>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.statText}>{entry.body.length}자</Text>
          </View>
        </View>

        {/* Comments section */}
        <View style={styles.commentsSection}>
          <View style={styles.commentsHeader}>
            <Text style={styles.commentsTitle}>댓글 {entry.comments.filter(c => !c.isUser).length}</Text>
            <Text style={styles.commentsSort}>최신순</Text>
          </View>

          {entry.comments.filter(c => !c.isUser).length === 0 && !nextPending && (
            <View style={styles.noComments}>
              <Text style={styles.noCommentsText}>아직 댓글이 없어요.</Text>
            </View>
          )}

          {topLevel.map(c => {
            const myReplies = allReplies.filter(r => r.replyTo === c._idx);
            return (
              <View key={c._idx}>
                <CommentRow
                  comment={c}
                  liked={!!liked[c._idx]}
                  onLike={() => toggleLike(c._idx)}
                  onReply={() => handleReplyPress(c.persona as PersonaKey, c._idx)}
                  timeAgoStr={timeAgo(c.createdAt)}
                  isReply={false}
                />
                {myReplies.map(r => (
                  r.isUser ? (
                    <UserCommentRow
                      key={r._idx}
                      comment={r}
                      timeAgoStr={timeAgo(r.createdAt)}
                    />
                  ) : (
                    <CommentRow
                      key={r._idx}
                      comment={r}
                      liked={!!liked[r._idx]}
                      onLike={() => toggleLike(r._idx)}
                      onReply={() => handleReplyPress(r.persona as PersonaKey, c._idx)}
                      timeAgoStr={timeAgo(r.createdAt)}
                      isReply
                      replyToName={r.isUser ? '나' : PERSONA_PROFILES[c.persona as PersonaKey]?.name}
                    />
                  )
                ))}
              </View>
            );
          })}

          {/* Upcoming comment indicator */}
          {nextPending && (
            <View style={styles.pendingRow}>
              <View style={[styles.pendingDot, { backgroundColor: PERSONA_META[nextPending.persona as PersonaKey]?.accent ?? PAL.muted }]} />
              <Text style={styles.pendingText}>
                {PERSONA_PROFILES[nextPending.persona as PersonaKey]?.name ?? 'AI'}가 읽는 중…{' '}
                <Text style={styles.pendingTime}>{timeUntil(nextPending.scheduledAt)}</Text>
              </Text>
            </View>
          )}

          {isReplying && (
            <View style={styles.pendingRow}>
              <View style={[styles.pendingDot, { backgroundColor: replyTarget ? PERSONA_META[replyTarget.personaKey]?.accent : PAL.muted }]} />
              <Text style={styles.pendingText}>
                {replyTarget ? PERSONA_PROFILES[replyTarget.personaKey]?.name : 'AI'}가 답글 쓰는 중…
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Fixed reply box */}
      <View style={[styles.replyBox, { paddingBottom: insets.bottom + 8 }]}>
        {replyTarget && (
          <View style={styles.replyTargetBar}>
            <Text style={[styles.replyTargetText, { color: PERSONA_META[replyTarget.personaKey]?.accent }]}>
              @ {PERSONA_PROFILES[replyTarget.personaKey]?.name}에게 답글
            </Text>
            <Pressable onPress={handleCancelReply} hitSlop={8}>
              <CloseIcon size={14} color={PAL.muted} />
            </Pressable>
          </View>
        )}
        <View style={styles.replyInputRow}>
          <View style={styles.replyAvatar}>
            <Text style={styles.replyAvatarText}>나</Text>
          </View>
          <TextInput
            ref={inputRef}
            style={styles.replyInput}
            placeholder={replyTarget ? '답글 쓰기…' : '답글 달 AI의 댓글을 탭하세요'}
            placeholderTextColor={PAL.faint}
            value={replyText}
            onChangeText={setReplyText}
            multiline
            editable={!!replyTarget}
            onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
          />
          <Pressable
            onPress={handleSubmitReply}
            disabled={!replyTarget || !replyText.trim() || isReplying}
            style={[styles.sendBtn, { opacity: replyTarget && replyText.trim() ? 1 : 0.3 }]}
          >
            <SendIcon size={16} color={replyTarget ? (PERSONA_META[replyTarget.personaKey]?.accent ?? PAL.indigo) : PAL.muted} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function CommentRow({
  comment, liked, onLike, onReply, timeAgoStr, isReply, replyToName,
}: {
  comment: AIComment & { _idx: number };
  liked: boolean;
  onLike: () => void;
  onReply: () => void;
  timeAgoStr: string;
  isReply: boolean;
  replyToName?: string;
}) {
  const personaKey = comment.persona as PersonaKey;
  const profile = PERSONA_PROFILES[personaKey];
  const meta = PERSONA_META[personaKey];
  const avatarSize = isReply ? 28 : 36;

  if (!profile || !meta) return null;

  return (
    <View style={[styles.commentRow, isReply && styles.commentRowReply]}>
      {isReply && <View style={styles.replyConnector} />}
      <Image
        source={profile.image}
        style={[styles.commentAvatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}
      />
      <View style={{ flex: 1 }}>
        {isReply && replyToName && (
          <Text style={styles.replyToLabel}>↩ {replyToName}에게 답글</Text>
        )}
        <View style={styles.commentMeta}>
          <Text style={styles.commentName}>{profile.name}</Text>
          <Text style={[styles.commentHandle, { color: meta.accent }]}>{meta.handle}</Text>
          <Text style={styles.commentTime}>· {timeAgoStr}</Text>
        </View>
        <Text style={styles.commentText}>{comment.text}</Text>
        <View style={styles.commentActions}>
          <Pressable onPress={onLike} style={styles.actionBtn}>
            <HeartIcon size={13} color={liked ? PAL.red : PAL.muted} filled={liked} />
          </Pressable>
          <Pressable onPress={onReply} style={styles.actionBtn}>
            <CommentIcon size={12} color={PAL.muted} />
            <Text style={styles.actionText}>답글</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function UserCommentRow({
  comment, timeAgoStr,
}: {
  comment: AIComment & { _idx: number };
  timeAgoStr: string;
}) {
  return (
    <View style={[styles.commentRow, styles.commentRowReply, styles.userCommentRow]}>
      <View style={styles.replyConnector} />
      <View style={styles.userAvatar}>
        <Text style={styles.userAvatarText}>나</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.commentMeta}>
          <Text style={styles.commentName}>나</Text>
          <Text style={styles.commentTime}>· {timeAgoStr}</Text>
        </View>
        <Text style={styles.commentText}>{comment.text}</Text>
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
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  moreBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  menuOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100,
  },
  menuBox: {
    position: 'absolute', top: 52, right: 14,
    backgroundColor: PAL.paper,
    borderRadius: 12, borderWidth: 1, borderColor: PAL.lineSoft,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    minWidth: 120, overflow: 'hidden',
  },
  menuItem: { paddingVertical: 13, paddingHorizontal: 18 },
  menuItemTextDanger: { fontSize: 15, color: PAL.red, fontWeight: '500' },
  postCard: {
    marginHorizontal: 20, marginTop: 8,
    backgroundColor: PAL.paper,
    borderRadius: 20, borderWidth: 1, borderColor: PAL.lineSoft,
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
    justifyContent: 'space-between', marginBottom: 14, paddingHorizontal: 4,
  },
  commentsTitle: {
    fontSize: 17, fontWeight: '500',
    color: PAL.ink, fontFamily: 'NotoSerifKR-Medium',
  },
  commentsSort: {
    fontSize: 11, color: PAL.muted, letterSpacing: 0.6, textTransform: 'uppercase',
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
    borderRadius: 12, marginTop: 2, marginBottom: 4,
    borderBottomWidth: 0,
  },
  userCommentRow: {
    backgroundColor: PAL.indigoDeep + '0C',
  },
  replyConnector: {
    position: 'absolute', left: 14, top: 0, bottom: 0,
    width: 1.5, backgroundColor: PAL.lineSoft,
  },
  commentAvatar: { flexShrink: 0 },
  userAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: PAL.indigoDeep,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  userAvatarText: { color: PAL.bg, fontSize: 11, fontWeight: '500' },
  replyToLabel: { fontSize: 11, color: PAL.muted, marginBottom: 4, letterSpacing: 0.2 },
  commentMeta: {
    flexDirection: 'row', alignItems: 'baseline',
    gap: 4, flexWrap: 'wrap', marginBottom: 6,
  },
  commentName: { fontSize: 13.5, fontWeight: '600', color: PAL.ink },
  commentHandle: { fontSize: 11.5, fontWeight: '500', letterSpacing: 0.2 },
  commentTime: { fontSize: 11, color: PAL.faint },
  commentText: {
    fontFamily: 'NotoSerifKR-Regular',
    fontSize: 14.5, lineHeight: 24,
    color: PAL.ink, letterSpacing: -0.1,
  },
  commentActions: { marginTop: 9, flexDirection: 'row', gap: 16, alignItems: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 11.5, color: PAL.muted },
  pendingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 4,
  },
  pendingDot: { width: 6, height: 6, borderRadius: 3, opacity: 0.6 },
  pendingText: { fontSize: 12.5, color: PAL.muted },
  pendingTime: { color: PAL.faint },
  // Reply box (fixed bottom)
  replyBox: {
    backgroundColor: PAL.paper,
    borderTopWidth: 1, borderTopColor: PAL.lineSoft,
    paddingHorizontal: 16, paddingTop: 10,
  },
  replyTargetBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 6, paddingHorizontal: 2,
  },
  replyTargetText: { fontSize: 11.5, fontWeight: '600', letterSpacing: 0.2 },
  replyInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: PAL.bg,
    borderRadius: 999, borderWidth: 1, borderColor: PAL.line,
  },
  replyAvatar: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: PAL.indigoDeep,
    alignItems: 'center', justifyContent: 'center',
  },
  replyAvatarText: { color: PAL.bg, fontSize: 11, fontWeight: '500' },
  replyInput: {
    flex: 1, fontSize: 13, color: PAL.ink,
    maxHeight: 80, paddingVertical: 0,
  },
  sendBtn: { padding: 4 },
});
