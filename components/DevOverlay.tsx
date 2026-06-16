import React, { useState, useEffect } from 'react';
import {
  View, Text, Pressable, Modal, ScrollView, StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { cancelDailyDiaryReminder } from '@/lib/notifications';
import { PAL } from '@/constants/palette';

const STORAGE_KEY = 'haru_qa_checked';

const CHECKLIST = [
  { id: 'build',    label: '빌드 최신 여부 확인 (마운트 시각 체크)' },
  { id: 'logout',   label: '로그아웃 → 온보딩 화면으로 이동' },
  { id: 'onboard1', label: '온보딩: 페르소나 3장 스와이프' },
  { id: 'onboard2', label: '온보딩: 알림 시간 선택 슬라이드 (4번째)' },
  { id: 'onboard3', label: '온보딩: "알림 없이 할게요" 스킵 작동' },
  { id: 'handle',   label: '댓글 핸들 @siwon.ai / @hakyung.ai / @chaea.ai' },
  { id: 'chaea',    label: '유채아 프로필 사진 표시' },
  { id: 'siwon',    label: '김시원 톤: 에너지 넘치는 친구 느낌' },
  { id: 'delay',    label: '유저 답글 → AI 즉시 안 달고 딜레이 있음' },
  { id: 'weekly1',  label: '주간탭: 7일 미만 → 대기 화면 + QA 버튼' },
  { id: 'weekly2',  label: '주간탭: QA 버튼 → 1명 페르소나 편지 형식' },
  { id: 'weekly3',  label: '주간탭: 페르소나 아바타 + 이름 표시' },
];

export default function DevOverlay() {
  if (!__DEV__) return null;

  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [mountTime] = useState(() => new Date().toLocaleTimeString('ko-KR'));

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) setChecked(JSON.parse(raw));
    });
  }, []);

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = { ...prev, [id]: !prev[id] };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const resetChecklist = () => {
    setChecked({});
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  };

  const resetToOnboarding = async () => {
    await supabase.auth.signOut();
    await AsyncStorage.multiRemove([
      'haru_onboarded',
      'haru_notif_time',
      'haru_weekly_notif_scheduled',
    ]);
    await cancelDailyDiaryReminder();
    setOpen(false);
    router.replace('/onboarding');
  };

  const done = Object.values(checked).filter(Boolean).length;

  return (
    <>
      <Pressable style={styles.fab} onPress={() => setOpen(true)}>
        <Text style={styles.fabText}>🛠</Text>
        {done > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{done}</Text>
          </View>
        )}
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>QA 체크리스트</Text>
              <Pressable onPress={resetChecklist} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>초기화</Text>
              </Pressable>
            </View>
            <Text style={styles.meta}>
              빌드 마운트: {mountTime} · {done}/{CHECKLIST.length} 완료
            </Text>
          </View>
          <ScrollView contentContainerStyle={styles.list}>
            {CHECKLIST.map(item => (
              <Pressable
                key={item.id}
                style={styles.item}
                onPress={() => toggle(item.id)}
              >
                <View style={[styles.checkbox, checked[item.id] && styles.checkboxDone]}>
                  {checked[item.id] && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={[styles.itemLabel, checked[item.id] && styles.itemLabelDone]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.resetBtn} onPress={resetToOnboarding}>
            <Text style={styles.resetBtnText}>🔄 온보딩 초기화 (로그아웃 + 스토리지 클리어)</Text>
          </Pressable>
          <Pressable style={styles.closeBtn} onPress={() => setOpen(false)}>
            <Text style={styles.closeBtnText}>닫기</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    top: 60, left: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(45,42,92,0.85)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4,
  },
  fabText: { fontSize: 18 },
  badge: {
    position: 'absolute', top: -4, right: -4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: PAL.amber,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  modal: { flex: 1, backgroundColor: PAL.bg },
  header: {
    paddingHorizontal: 24, paddingTop: 32, paddingBottom: 16,
    borderBottomWidth: 1, borderColor: PAL.line,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  title: {
    fontSize: 22, fontWeight: '600', color: PAL.ink,
    fontFamily: 'NotoSerifKR-Medium',
  },
  clearBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, backgroundColor: PAL.lineSoft,
  },
  clearBtnText: { fontSize: 12, color: PAL.muted, fontWeight: '500' },
  meta: { fontSize: 12, color: PAL.muted, marginTop: 6 },
  list: { padding: 20, gap: 4 },
  item: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderColor: PAL.lineSoft,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: PAL.line,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1, flexShrink: 0,
  },
  checkboxDone: { backgroundColor: PAL.indigoDeep, borderColor: PAL.indigoDeep },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  itemLabel: { flex: 1, fontSize: 14, color: PAL.ink, lineHeight: 20 },
  itemLabelDone: { color: PAL.muted, textDecorationLine: 'line-through' },
  resetBtn: {
    marginHorizontal: 20, marginTop: 20, paddingVertical: 14,
    borderRadius: 14, backgroundColor: '#8B1A1A22',
    borderWidth: 1, borderColor: '#8B1A1A44',
    alignItems: 'center',
  },
  resetBtnText: { color: '#8B1A1A', fontSize: 13, fontWeight: '600' },
  closeBtn: {
    margin: 20, marginTop: 10, paddingVertical: 16,
    borderRadius: 14, backgroundColor: '#2D2A5C',
    alignItems: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
