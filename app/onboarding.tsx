import React, { useState } from 'react';
import {
  View, Text, Image, Pressable, StyleSheet, Dimensions,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PAL } from '@/constants/palette';
import { PERSONAS } from '@/lib/personas';
import { ensureAuth } from '@/lib/auth';
import {
  requestNotificationPermissions,
  scheduleDailyDiaryReminder,
} from '@/lib/notifications';

const { width } = Dimensions.get('window');
const ONBOARDING_KEY = 'haru_onboarded';

const NOTIF_OPTIONS = [
  { label: '🌅 아침에',    desc: '어제를 돌아보거나 오늘을 시작하기 전에', hour: 7,  minute: 0 },
  { label: '☀️ 점심에',    desc: '잠깐 숨 돌리는 틈에',                   hour: 12, minute: 0 },
  { label: '🌆 저녁에',    desc: '하루 일을 마치고 집에 오는 길에',         hour: 18, minute: 0 },
  { label: '🌙 자기 전에', desc: '하루를 되감으며 잠들기 전에',             hour: 22, minute: 0 },
];

function makeDate(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0); // 0: 친구 소개, 1: 알림 설정
  const [selectedOption, setSelectedOption] = useState<typeof NOTIF_OPTIONS[0] | null>(null);
  const [pickerDate, setPickerDate] = useState(new Date());

  const selectOption = (opt: typeof NOTIF_OPTIONS[0]) => {
    setSelectedOption(opt);
    setPickerDate(makeDate(opt.hour, opt.minute));
  };

  const goNext = async () => {
    if (step === 0) {
      setStep(1);
      return;
    }
    // 완료
    if (selectedOption) {
      const h = pickerDate.getHours();
      const m = pickerDate.getMinutes();
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      await AsyncStorage.setItem('haru_notif_time', timeStr);
      const granted = await requestNotificationPermissions();
      if (granted) await scheduleDailyDiaryReminder(h, m);
    }
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    await ensureAuth();
    router.replace('/(tabs)');
  };

  const skipNotif = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    await ensureAuth();
    router.replace('/(tabs)');
  };

  const personas = [PERSONAS.insighter, PERSONAS.wit, PERSONAS.coach];

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>

      {step === 0 ? (
        /* ── 친구 소개 페이지 ── */
        <View style={styles.introPage}>
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
          <Text style={styles.introHeadline}>
            {'세 친구가\n매일 일기를 읽어줄 거예요'}
          </Text>
          <Text style={styles.introBody}>
            일기를 쓰면 각자의 방식으로{'\n'}코멘트를 남겨줘요
          </Text>
        </View>
      ) : (
        /* ── 알림 설정 페이지 ── */
        <View style={styles.notifPage}>
          <Text style={styles.notifHeadline}>
            {'언제 일기 쓸 시간이\n날 것 같아요?'}
          </Text>
          <Text style={styles.notifSub}>알림을 보내드릴게요</Text>

          <View style={styles.optionList}>
            {NOTIF_OPTIONS.map(opt => {
              const isSelected = selectedOption?.label === opt.label;
              return (
                <Pressable
                  key={opt.label}
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
                  {isSelected && (
                    <View style={styles.pickerRow}>
                      <Text style={styles.pickerLabel}>알림 시각</Text>
                      <DateTimePicker
                        value={pickerDate}
                        mode="time"
                        display="compact"
                        onChange={(_, date) => { if (date) setPickerDate(date); }}
                        style={styles.picker}
                        themeVariant="light"
                      />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* 하단 고정 */}
      <View style={styles.bottom}>
        {/* Dots */}
        <View style={styles.dots}>
          {[0, 1].map(i => (
            <View key={i} style={[styles.dot, step === i && styles.dotActive]} />
          ))}
        </View>

        <Pressable style={styles.btn} onPress={goNext}>
          <Text style={styles.btnText}>
            {step === 0 ? '다음' : '시작하기'}
          </Text>
        </Pressable>

        {step === 1 && (
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

  /* 친구 소개 */
  introPage: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 28,
  },
  avatarRow: {
    flexDirection: 'row', gap: 20, alignItems: 'flex-start',
  },
  avatarWrap: { alignItems: 'center', gap: 8 },
  avatar: { width: 84, height: 84, borderRadius: 42 },
  nameBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  nameText: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  introHeadline: {
    fontSize: 28, fontWeight: '400', color: PAL.ink,
    fontFamily: 'NotoSerifKR-Regular',
    textAlign: 'center', lineHeight: 42,
  },
  introBody: {
    fontSize: 15, color: PAL.muted,
    textAlign: 'center', lineHeight: 24,
  },

  /* 알림 설정 */
  notifPage: {
    flex: 1, paddingHorizontal: 24, paddingTop: 40,
  },
  notifHeadline: {
    fontSize: 28, fontWeight: '400', color: PAL.ink,
    fontFamily: 'NotoSerifKR-Regular',
    lineHeight: 42, marginBottom: 8,
  },
  notifSub: {
    fontSize: 14, color: PAL.muted, marginBottom: 28,
  },
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
  pickerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  pickerLabel: { fontSize: 13, color: 'rgba(245,220,182,0.8)' },
  picker: { height: 36 },

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
  skipBtn: { marginTop: 14, padding: 8 },
  skipText: { fontSize: 14, color: PAL.muted },
});
