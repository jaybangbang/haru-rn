import React, { useState } from 'react';
import {
  View, Text, Image, Pressable, StyleSheet, Dimensions,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PAL } from '@/constants/palette';
import { Toast } from '@/components/Toast';
import { PERSONAS } from '@/lib/personas';
import { ensureAuth } from '@/lib/auth';
import {
  requestNotificationPermissions,
  scheduleDailyDiaryReminder,
} from '@/lib/notifications';

const { width } = Dimensions.get('window');
const ONBOARDING_KEY = 'perpetual_onboarded';

const NOTIF_OPTIONS = [
  { label: '🌅 아침에',    desc: '출근 길에 어제를 돌아보며',              hour: 7,  minute: 0 },
  { label: '☀️ 점심에',    desc: '잠깐 숨 돌리는 틈에',                   hour: 12, minute: 0 },
  { label: '🌆 저녁에',    desc: '하루 일을 마치고 집에 오는 길에',         hour: 18, minute: 0 },
  { label: '🌙 자기 전에', desc: '하루를 되감으며 잠들기 전에',             hour: 22, minute: 0 },
];

const REPORT_ITEMS = ['핵심 사건', '반복 패턴', '미결 질문', '제언'];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0); // 0~4
  const [selectedOption, setSelectedOption] = useState<typeof NOTIF_OPTIONS[0] | null>(null);
  const [pickerDate, setPickerDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [pendingPickerDate, setPendingPickerDate] = useState(new Date());

  const selectOption = (opt: typeof NOTIF_OPTIONS[0]) => {
    setSelectedOption(opt);
    const d = new Date();
    d.setHours(opt.hour, opt.minute, 0, 0);
    setPickerDate(d);
    setPendingPickerDate(d);
    setShowPicker(true);
  };

  const goNext = async () => {
    if (step < 4) {
      setStep(s => s + 1);
      return;
    }
    try {
      if (selectedOption) {
        const hour = pickerDate.getHours();
        const minute = pickerDate.getMinutes();
        const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        await AsyncStorage.setItem('perpetual_notif_time', timeStr);
        const granted = await requestNotificationPermissions();
        if (granted) await scheduleDailyDiaryReminder(hour, minute);
      }
      await AsyncStorage.setItem(ONBOARDING_KEY, '1');
      await ensureAuth();
      router.replace('/(tabs)');
    } catch {
      Toast.show('오류가 발생했어요. 다시 시도해주세요.');
    }
  };

  const skipNotif = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    await ensureAuth();
    router.replace('/(tabs)');
  };

  const personas = [PERSONAS.insighter, PERSONAS.wit, PERSONAS.coach];

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>

      {/* 뒤로가기 버튼 — Step 1~4에서 표시 */}
      {step > 0 && (
        <Pressable
          style={[styles.backBtn, { top: insets.top + 8 }]}
          onPress={() => setStep(s => s - 1)}
          hitSlop={12}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
      )}

      {/* ── Step 0: 훅 ── */}
      {step === 0 && (
        <View style={styles.page}>
          <Text style={styles.headline}>
            {'내 일기, 한 번 쓰고\n안 본다면?'}
          </Text>
          <Text style={styles.body}>
            {'이제 AI 친구들과 함께 봐요'}
          </Text>
        </View>
      )}

      {/* ── Step 1: 플랫폼 ── */}
      {step === 1 && (
        <View style={styles.page}>
          <View style={styles.platformBadge}>
            <Text style={styles.platformText}>{'📱 모바일앱으로도\n💻 PC 웹으로도'}</Text>
          </View>
          <Text style={styles.headline}>
            {'언제 어디서나\n편하게 작성할 수 있어요'}
          </Text>
        </View>
      )}

      {/* ── Step 2: AI 친구 소개 ── */}
      {step === 2 && (
        <View style={styles.page}>
          <View style={styles.avatarRow}>
            {personas.map(p => (
              <View key={p.key} style={styles.avatarWrap}>
                <Image source={p.image} style={styles.avatar} />
                <View style={[styles.nameBadge, { backgroundColor: p.color + '22' }]}>
                  <Text style={[styles.nameText, { color: p.color }]}>{p.name}</Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={styles.headline}>
            {'AI 친구가 일기를\n읽고 댓글을 달아줘요'}
          </Text>
        </View>
      )}

      {/* ── Step 3: 주간 리포트 ── */}
      {step === 3 && (
        <View style={styles.page}>
          <View style={styles.reportCard}>
            <Text style={styles.reportCardTitle}>AI 주간 리포트</Text>
            {REPORT_ITEMS.map((item, i) => (
              <View key={item} style={styles.reportCardRow}>
                <Text style={styles.reportCardItem}>{item}</Text>
                <View style={[styles.reportCardBar, { width: `${70 - i * 10}%` as any }]} />
              </View>
            ))}
          </View>
          <Text style={styles.headline}>
            {'한 주 일기가 쌓이면\n분석 리포트가 도착해요'}
          </Text>
        </View>
      )}

      {/* ── Step 4: 알림 설정 ── */}
      {step === 4 && (
        <View style={styles.notifPage}>
          <Text style={styles.headline}>
            {'언제 일기 쓸 시간이\n날 것 같아요?'}
          </Text>
          <Text style={styles.notifSub}>알림을 보내드릴게요</Text>

          <View style={styles.optionList}>
            {NOTIF_OPTIONS.map(opt => {
              const isSelected = selectedOption?.label === opt.label;
              return (
                <View key={opt.label}>
                  <Pressable
                    style={[styles.option, isSelected && styles.optionSelected]}
                    onPress={() => selectOption(opt)}
                  >
                    <View style={styles.optionTop}>
                      <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                        {opt.label}
                      </Text>
                      <Text style={[styles.optionDesc, isSelected && styles.optionDescSelected]}>
                        {opt.desc}
                      </Text>
                    </View>
                  </Pressable>
                  {isSelected && showPicker && (
                    <View style={styles.pickerSection}>
                      <DateTimePicker
                        value={pendingPickerDate}
                        mode="time"
                        display="spinner"
                        locale="ko-KR"
                        style={{ backgroundColor: PAL.bg }}
                        onChange={(_, date) => { if (date) setPendingPickerDate(date); }}
                      />
                      <Pressable
                        style={styles.pickerConfirmBtn}
                        onPress={() => {
                          setPickerDate(pendingPickerDate);
                          setShowPicker(false);
                        }}
                      >
                        <Text style={styles.pickerConfirmBtnText}>확인</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

        </View>
      )}

      {/* 하단 고정 */}
      <View style={styles.bottom}>
        <View style={styles.dots}>
          {[0, 1, 2, 3, 4].map(i => (
            <View key={i} style={[styles.dot, step === i && styles.dotActive]} />
          ))}
        </View>

        <Pressable
          style={[styles.btn, (step === 4 && !selectedOption) && styles.btnDisabled]}
          onPress={step === 4 && !selectedOption
            ? () => Toast.show('리마인드 받을 시간대를 선택하세요')
            : goNext}
        >
          <Text style={styles.btnText}>
            {step < 4 ? '다음' : '시작하기'}
          </Text>
        </Pressable>

        {step === 4 && (
          <Pressable onPress={skipNotif} style={styles.skipBtn}>
            <Text style={styles.skipText}>알림 없이 할게요</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: PAL.bg,
    justifyContent: 'space-between',
  },

  /* 공통 페이지 */
  page: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 24,
  },
  headline: {
    fontSize: 28, fontWeight: '400', color: PAL.ink,
    fontFamily: 'NotoSerifKR-Regular',
    textAlign: 'center', lineHeight: 42,
  },
  body: {
    fontSize: 17, color: PAL.ink,
    textAlign: 'center', lineHeight: 26, fontWeight: '500',
  },

  /* Step 1 — 플랫폼 */
  platformBadge: {
    backgroundColor: PAL.paper, borderRadius: 14,
    padding: 20, borderWidth: 1, borderColor: PAL.lineSoft,
    width: '100%', alignItems: 'center',
  },
  platformText: {
    fontSize: 16, color: PAL.muted, textAlign: 'center', lineHeight: 28,
  },

  /* Step 2 — AI 친구 */
  avatarRow: {
    flexDirection: 'row', gap: 20, alignItems: 'flex-start',
  },
  avatarWrap: { alignItems: 'center', gap: 8 },
  avatar: { width: 84, height: 84, borderRadius: 42 },
  nameBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  nameText: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },

  /* Step 3 — 리포트 카드 */
  reportCard: {
    backgroundColor: PAL.paper, borderRadius: 16,
    padding: 20, width: '100%', gap: 14,
    borderWidth: 1, borderColor: PAL.lineSoft,
  },
  reportCardTitle: {
    fontSize: 11, color: PAL.muted,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4,
  },
  reportCardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reportCardItem: { fontSize: 13, color: PAL.ink, width: 72 },
  reportCardBar: { height: 6, borderRadius: 3, backgroundColor: PAL.lineSoft },

  /* Step 4 — 알림 설정 */
  notifPage: {
    flex: 1, paddingHorizontal: 24, paddingTop: 40,
  },
  notifSub: {
    fontSize: 14, color: PAL.muted, marginBottom: 28, marginTop: 8,
  },
  pickerSection: {
    backgroundColor: PAL.paper,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  pickerConfirmBtn: {
    marginHorizontal: 4, marginBottom: 4, paddingVertical: 12,
    backgroundColor: PAL.indigoDeep, borderRadius: 12, alignItems: 'center',
  },
  pickerConfirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  optionList: { gap: 10 },
  option: {
    paddingVertical: 14, paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: PAL.paper,
    borderWidth: 1.5, borderColor: PAL.lineSoft,
  },
  optionSelected: {
    backgroundColor: PAL.indigoDeep,
    borderColor: PAL.indigoDeep,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  optionTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  optionLabel: {
    fontSize: 15, fontWeight: '600', color: PAL.ink,
  },
  optionLabelSelected: { color: '#F5DCB6' },
  optionDesc: { fontSize: 12, color: PAL.muted },
  optionDescSelected: { color: 'rgba(245,220,182,0.65)' },
  /* 하단 */
  bottom: { paddingHorizontal: 24, alignItems: 'center', gap: 0 },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: PAL.line,
  },
  dotActive: { backgroundColor: PAL.indigoDeep, width: 18 },
  btn: {
    width: width - 48, paddingVertical: 16,
    borderRadius: 16, alignItems: 'center',
    backgroundColor: PAL.indigoDeep,
  },
  btnText: { color: PAL.bg, fontSize: 16, fontWeight: '600' },
  btnDisabled: { opacity: 0.4 },
  skipBtn: { marginTop: 14, padding: 8 },
  skipText: { fontSize: 14, color: PAL.muted },
  backBtn: {
    position: 'absolute', left: 20, zIndex: 10,
    padding: 8,
  },
  backText: { fontSize: 32, color: PAL.muted, lineHeight: 36 },
});
