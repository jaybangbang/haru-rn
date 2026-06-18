import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, RefreshControl,
  Modal, FlatList, SafeAreaView, Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import CalendarPicker from '@/components/CalendarPicker';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { PAL } from '@/constants/palette';
import { AIComment, DiaryEntry, PersonaKey } from '@/lib/types';
import { loadEntries, formatDate, getLastReadAt, setLastReadAt } from '@/lib/storage';
import { cancelDailyDiaryReminder, scheduleDailyDiaryReminder } from '@/lib/notifications';
import EntryCard from '@/components/EntryCard';
import { SparkleIcon, PenIcon, ArrowRightIcon, BellIcon, MagnifyIcon, BoltIcon, CompassIcon, PersonIcon } from '@/components/Icons';

const PROMPTS = [
  '🔥 오늘 가장 잘 풀린 일은 무엇이었나요?',
  '💡 오늘 처음 입에서 나온 문장이 있다면?',
  '🎯 이번 주 끝내고 싶은 한 가지는?',
  '✨ 1년 전의 나에게 오늘 한 줄 보낸다면?',
];

const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];

const PERSONA_META = {
  insighter: { nameKo: '김시원', color: '#1B173F', Icon: MagnifyIcon },
  wit:       { nameKo: '한하경', color: '#D9914A', Icon: BoltIcon },
  coach:     { nameKo: '유채아', color: '#7A8A66', Icon: CompassIcon },
} as const;

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${DOW_KO[d.getDay()]}요일`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr / 24)}일 전`;
}

interface NotifItem {
  comment: AIComment;
  entry: DiaryEntry;
  commentIdx: number;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [promptIdx, setPromptIdx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifItems, setNotifItems] = useState<NotifItem[]>([]);
  const lastReadAt = useRef<number>(0);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [notifTime, setNotifTime] = useState<Date | null>(null);
  const [pendingNotifTime, setPendingNotifTime] = useState<Date | null>(null);
  const [showNotifPicker, setShowNotifPicker] = useState(false);

  const todayStr = formatDate(new Date());
  const selectedStr = formatDate(selectedDate);
  const isToday = selectedStr === todayStr;
  const todayEntry = entries.find(e => e.date === selectedStr);

  const loadData = useCallback(async () => {
    const [all, lrAt] = await Promise.all([loadEntries(), getLastReadAt()]);
    lastReadAt.current = lrAt;
    setEntries(all);

    const { data: { user } } = await supabase.auth.getUser();
    setIsAnonymous(user?.is_anonymous ?? true);
    setUserEmail(user?.email ?? user?.user_metadata?.full_name ?? null);

    // Collect all AI comments across entries, sorted newest first
    const items: NotifItem[] = [];
    for (const entry of all) {
      entry.comments.forEach((c, idx) => {
        if (!c.isUser) items.push({ comment: c, entry, commentIdx: idx });
      });
    }
    items.sort((a, b) => b.comment.createdAt - a.comment.createdAt);
    setNotifItems(items);
    setUnreadCount(items.filter(i => i.comment.createdAt > lrAt).length);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  useEffect(() => {
    if (!showAccountModal) return;
    AsyncStorage.getItem('haru_notif_time').then(raw => {
      if (!raw) return;
      const [h, m] = raw.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      setNotifTime(d);
    });
  }, [showAccountModal]);

  useEffect(() => {
    const t = setInterval(() => setPromptIdx(i => (i + 1) % PROMPTS.length), 4200);
    return () => clearInterval(t);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const openNotifs = async () => {
    setShowNotifs(true);
    const now = Date.now();
    await setLastReadAt(now);
    lastReadAt.current = now;
    setUnreadCount(0);
  };

  const recent = entries.filter(e => e.date !== todayStr).slice(0, 10);

  return (
    <>
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
          <View style={styles.topActions}>
            {/* Bell */}
            <Pressable onPress={openNotifs} style={styles.bellBtn} hitSlop={8}>
              <BellIcon size={22} color={PAL.ink} filled={unreadCount > 0} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </Pressable>
            <Pressable
              onPress={() => isAnonymous ? router.push('/auth') : setShowAccountModal(true)}
              hitSlop={8}
              style={[styles.avatar, isAnonymous && styles.avatarAnon]}
            >
              {isAnonymous
                ? <PersonIcon size={18} color={PAL.muted} />
                : <Text style={styles.avatarText}>{(userEmail?.[0] ?? '?').toUpperCase()}</Text>
              }
            </Pressable>
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

        {/* Today / Selected date */}
        <View style={styles.section}>
          <Pressable onPress={() => setShowPicker(v => !v)} style={styles.dateSelectorBtn}>
            <Text style={styles.dateSelectorText}>
              {isToday
                ? `TODAY · ${selectedDate.getMonth() + 1}.${selectedDate.getDate()}`
                : `${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일 · 과거 일기`}
            </Text>
            <Text style={styles.dateSelectorCaret}>{showPicker ? '▲' : '▼'}</Text>
          </Pressable>

          {showPicker && (
            <CalendarPicker
              selectedDate={selectedDate}
              entryDates={new Set(entries.map(e => e.date))}
              onSelect={(date) => { setSelectedDate(date); setShowPicker(false); }}
            />
          )}

          {todayEntry ? (
            <Pressable onPress={() => router.push(`/entry/${todayEntry.id}`)} style={styles.todayCard}>
              <Text style={styles.todayBody} numberOfLines={3}>{todayEntry.body}</Text>
              <View style={styles.todayFooter}>
                {todayEntry.emotions.slice(0, 2).map(em => (
                  <Text key={em.key} style={styles.todayEmotion}>{em.emoji} {em.label}</Text>
                ))}
              </View>
            </Pressable>
          ) : (
            <Pressable
              style={styles.emptyCard}
              onPress={() => router.push({ pathname: '/write', params: { date: selectedStr } })}
            >
              <View style={styles.ruledLines} />
              <View style={{ position: 'relative' }}>
                <Text style={styles.emptyTitle}>
                  {isToday ? '오늘의 진전을 기록해볼까요.' : '이 날의 기억을 기록해볼까요.'}
                </Text>
                <Text style={styles.emptySub}>짧은 한 줄도 괜찮아요. 내일의 자신이 고마워할 거예요.</Text>
                <View style={styles.writeBtn}>
                  <PenIcon size={14} color={PAL.bg} />
                  <Text style={styles.writeBtnText}>{isToday ? '오늘의 일기 쓰기' : '이 날 일기 쓰기'}</Text>
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

      {/* Account modal */}
      <Modal visible={showAccountModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAccountModal(false)}>
        <SafeAreaView style={styles.accountModal}>
          <View style={styles.accountHeader}>
            <Text style={styles.accountTitle}>계정</Text>
            <Pressable onPress={() => setShowAccountModal(false)} hitSlop={12}>
              <Text style={styles.panelClose}>닫기</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.accountScroll}>
            {/* Avatar */}
            <View style={styles.accountAvatarSection}>
              <View style={styles.accountAvatarLarge}>
                <Text style={styles.accountAvatarText}>{(userEmail?.[0] ?? '?').toUpperCase()}</Text>
              </View>
              <Text style={styles.accountEmail}>{userEmail ?? '—'}</Text>
            </View>

            {/* Settings */}
            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionLabel}>설정</Text>

              {/* Notification time */}
              <Pressable
                style={styles.settingsRow}
                onPress={() => {
                  setPendingNotifTime(notifTime);
                  setShowNotifPicker(v => !v);
                }}
              >
                <Text style={styles.settingsRowIcon}>🔔</Text>
                <Text style={styles.settingsRowLabel}>알림 시간</Text>
                <View style={styles.settingsRowRight}>
                  <View style={styles.dailyTag}><Text style={styles.dailyTagText}>매일</Text></View>
                  <Text style={styles.settingsRowValue}>
                    {notifTime
                      ? notifTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true })
                      : '설정 안 됨'}
                  </Text>
                </View>
              </Pressable>
              {showNotifPicker && (
                <View>
                  <DateTimePicker
                    value={pendingNotifTime ?? notifTime ?? new Date()}
                    mode="time"
                    display="spinner"
                    locale="ko-KR"
                    style={{ backgroundColor: PAL.bg }}
                    onChange={(_, date) => { if (date) setPendingNotifTime(date); }}
                  />
                  <Pressable
                    style={styles.notifConfirmBtn}
                    onPress={async () => {
                      const date = pendingNotifTime ?? notifTime;
                      if (!date) return;
                      const h = date.getHours();
                      const m = date.getMinutes();
                      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                      await AsyncStorage.setItem('haru_notif_time', timeStr);
                      await scheduleDailyDiaryReminder(h, m);
                      setNotifTime(date);
                      setShowNotifPicker(false);
                    }}
                  >
                    <Text style={styles.notifConfirmBtnText}>확인</Text>
                  </Pressable>
                </View>
              )}

              {/* Web CTA */}
              <View style={styles.settingsRow}>
                <Text style={styles.settingsRowIcon}>💻</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsRowLabel}>웹에서도 작성할 수 있어요</Text>
                  <Text style={styles.settingsRowSub}>입력할 게 많을 땐 PC로 작성해보세요</Text>
                </View>
                <Pressable
                  style={styles.settingsRowBtn}
                  onPress={() => Linking.openURL('https://haru-web-ten.vercel.app')}
                >
                  <Text style={styles.settingsRowBtnText}>열기</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>

          <Pressable
            style={styles.logoutBtn}
            onPress={async () => {
              await supabase.auth.signOut();
              await AsyncStorage.multiRemove([
                'haru_onboarded',
                'haru_notif_time',
                'haru_weekly_notif_scheduled',
              ]);
              await cancelDailyDiaryReminder();
              router.replace('/onboarding');
            }}
          >
            <Text style={styles.logoutBtnText}>로그아웃</Text>
          </Pressable>
        </SafeAreaView>
      </Modal>

      {/* Notification Panel */}
      <Modal
        visible={showNotifs}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNotifs(false)}
      >
        <SafeAreaView style={styles.panelContainer}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>AI 댓글 알림</Text>
            <Pressable onPress={() => setShowNotifs(false)} hitSlop={12}>
              <Text style={styles.panelClose}>닫기</Text>
            </Pressable>
          </View>

          {notifItems.length === 0 ? (
            <View style={styles.panelEmpty}>
              <Text style={styles.panelEmptyText}>아직 AI 댓글이 없어요.{'\n'}일기를 쓰면 AI들이 읽고 댓글을 달아줄 거예요.</Text>
            </View>
          ) : (
            <FlatList
              data={notifItems}
              keyExtractor={(item, i) => `${item.entry.id}-${item.commentIdx}-${i}`}
              contentContainerStyle={{ paddingBottom: 40 }}
              renderItem={({ item }) => {
                const meta = PERSONA_META[item.comment.persona as PersonaKey];
                const isUnread = item.comment.createdAt > lastReadAt.current;
                return (
                  <Pressable
                    style={[styles.notifItem, isUnread && styles.notifItemUnread]}
                    onPress={() => {
                      setShowNotifs(false);
                      router.push(`/entry/${item.entry.id}`);
                    }}
                  >
                    <View style={[styles.notifAvatar, { backgroundColor: meta?.color ?? PAL.indigo }]}>
                      {meta && <meta.Icon size={14} color="#fff" />}
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={styles.notifMeta}>
                        <Text style={styles.notifName}>{meta?.nameKo ?? item.comment.persona}</Text>
                        <Text style={styles.notifTime}>{timeAgo(item.comment.createdAt)}</Text>
                      </View>
                      <Text style={styles.notifText} numberOfLines={2}>{item.comment.text}</Text>
                      <Text style={styles.notifEntry} numberOfLines={1}>↳ {item.entry.preview}</Text>
                    </View>
                    {isUnread && <View style={styles.unreadDot} />}
                  </Pressable>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.notifSep} />}
            />
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 0 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 0,
  },
  appName: {
    fontSize: 28, fontWeight: '500', color: PAL.ink,
    fontFamily: 'NotoSerifKR-Medium', letterSpacing: 0.3,
  },
  dateText: { marginTop: 6, fontSize: 12, color: PAL.muted, letterSpacing: 0.5 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bellBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: 2, right: 2,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: PAL.red,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: PAL.indigoDeep,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarAnon: {
    backgroundColor: 'transparent',
    borderWidth: 1.5, borderColor: PAL.line,
  },
  avatarText: { color: PAL.bg, fontSize: 14, fontWeight: '600' },
  accountModal: { flex: 1, backgroundColor: PAL.bg },
  accountHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: PAL.lineSoft,
  },
  accountTitle: { fontSize: 17, fontWeight: '600', color: PAL.ink, fontFamily: 'NotoSerifKR-Medium' },
  accountScroll: { paddingBottom: 16 },
  accountAvatarSection: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  accountAvatarLarge: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: PAL.indigoDeep,
    alignItems: 'center', justifyContent: 'center',
  },
  accountAvatarText: { color: PAL.bg, fontSize: 28, fontWeight: '600' },
  accountEmail: { fontSize: 15, color: PAL.muted },
  settingsSection: {
    marginHorizontal: 20,
    backgroundColor: PAL.paper,
    borderRadius: 16,
    borderWidth: 1, borderColor: PAL.lineSoft,
    overflow: 'hidden',
  },
  settingsSectionLabel: {
    fontSize: 11, color: PAL.muted, letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
  },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    gap: 12,
    borderTopWidth: 1, borderTopColor: PAL.lineSoft,
  },
  settingsRowIcon: { fontSize: 16 },
  settingsRowLabel: { flex: 1, fontSize: 15, color: PAL.ink },
  settingsRowSub: { fontSize: 11.5, color: PAL.muted, marginTop: 2 },
  settingsRowValue: { fontSize: 14, color: PAL.muted },
  settingsRowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dailyTag: {
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: PAL.indigoDeep + '18',
    borderRadius: 999,
  },
  dailyTagText: { fontSize: 11, color: PAL.indigoDeep, fontWeight: '600' },
  notifConfirmBtn: {
    marginHorizontal: 16, marginBottom: 14, paddingVertical: 12,
    backgroundColor: PAL.indigoDeep, borderRadius: 12, alignItems: 'center',
  },
  notifConfirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  settingsRowBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: PAL.indigoDeep, borderRadius: 999,
  },
  settingsRowBtnText: { fontSize: 13, color: PAL.bg, fontWeight: '600' },
  logoutBtn: {
    margin: 20, marginTop: 16, padding: 16, borderRadius: 14,
    backgroundColor: PAL.paper,
    borderWidth: 1, borderColor: PAL.line,
    alignItems: 'center',
  },
  logoutBtnText: { fontSize: 15, color: PAL.red, fontWeight: '500' },
  promptBanner: {
    marginTop: 22, marginHorizontal: 20,
    paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: 'rgba(217,145,74,0.12)',
    borderRadius: 14, borderWidth: 1, borderColor: PAL.line,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  promptText: {
    fontSize: 13.5, fontWeight: '500', color: PAL.indigoDeep,
    letterSpacing: -0.1, lineHeight: 20,
  },
  section: { paddingHorizontal: 20, marginTop: 28 },
  sectionLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 12, color: PAL.muted, letterSpacing: 1.5,
    textTransform: 'uppercase', fontFamily: 'NotoSerifKR-Regular',
  },
  sectionLabelCaret: {
    fontSize: 9, color: PAL.faint,
  },
  dateSelectorBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: PAL.paper,
    borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: PAL.lineSoft,
    marginBottom: 12,
  },
  dateSelectorText: {
    fontSize: 12, color: PAL.indigoDeep, letterSpacing: 1.2,
    textTransform: 'uppercase', fontFamily: 'NotoSerifKR-Regular', fontWeight: '600',
  },
  dateSelectorCaret: {
    fontSize: 11, color: PAL.indigoDeep, fontWeight: '900',
  },
  emptyCard: {
    backgroundColor: PAL.paper, borderRadius: 18, padding: 28,
    borderWidth: 1, borderStyle: 'dashed', borderColor: PAL.line, overflow: 'hidden',
  },
  ruledLines: { position: 'absolute', inset: 0, opacity: 0.7 },
  emptyTitle: {
    fontFamily: 'NotoSerifKR-Regular', fontSize: 18,
    fontWeight: '400', color: PAL.ink, lineHeight: 28,
  },
  emptySub: {
    marginTop: 6, fontFamily: 'NotoSerifKR-Regular',
    fontSize: 14, color: PAL.muted, lineHeight: 22,
  },
  writeBtn: {
    marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 999, backgroundColor: PAL.indigoDeep,
  },
  writeBtnText: { color: PAL.bg, fontSize: 13, fontWeight: '500', letterSpacing: -0.1 },
  todayCard: {
    backgroundColor: PAL.paper, borderRadius: 18, padding: 20,
    borderWidth: 1, borderColor: PAL.lineSoft,
  },
  todayBody: { fontFamily: 'NotoSerifKR-Regular', fontSize: 16, lineHeight: 28, color: PAL.ink },
  todayFooter: { flexDirection: 'row', gap: 8, marginTop: 12 },
  todayEmotion: { fontSize: 12, color: PAL.muted },
  recentHeader: {
    flexDirection: 'row', alignItems: 'baseline',
    justifyContent: 'space-between', marginBottom: 14,
  },
  recentCount: { fontSize: 12, color: PAL.faint },
  entryList: { gap: 10 },
  footer: {
    marginTop: 32, textAlign: 'center', fontSize: 12, color: PAL.faint,
    fontFamily: 'NotoSerifKR-Regular', fontStyle: 'italic', letterSpacing: 0.8,
  },
  // Notification panel
  panelContainer: { flex: 1, backgroundColor: PAL.bg },
  panelHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: PAL.lineSoft,
  },
  panelTitle: {
    fontSize: 17, fontWeight: '600', color: PAL.ink,
    fontFamily: 'NotoSerifKR-Medium',
  },
  panelClose: { fontSize: 14, color: PAL.muted },
  panelEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  panelEmptyText: { fontSize: 15, color: PAL.muted, textAlign: 'center', lineHeight: 24 },
  notifItem: {
    flexDirection: 'row', gap: 12, padding: 16,
    paddingHorizontal: 20, alignItems: 'flex-start',
  },
  notifItemUnread: { backgroundColor: PAL.paper },
  notifAvatar: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  notifMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  notifName: { fontSize: 13, fontWeight: '600', color: PAL.ink },
  notifTag: {
    fontSize: 10, color: PAL.muted,
    backgroundColor: PAL.lineSoft,
    paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: 999,
  },
  notifTime: { fontSize: 11, color: PAL.faint },
  notifText: {
    fontFamily: 'NotoSerifKR-Regular',
    fontSize: 13.5, lineHeight: 21, color: PAL.ink,
  },
  notifEntry: { fontSize: 11.5, color: PAL.faint },
  notifSep: { height: 1, backgroundColor: PAL.lineSoft, marginHorizontal: 20 },
  unreadDot: {
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: PAL.red, marginTop: 6, flexShrink: 0,
  },
});
