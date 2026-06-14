import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PAL } from '@/constants/palette';
import { FlameIcon, CheckIcon } from './Icons';

interface StreakData {
  current: number;
  best: number;
  thisYear: number;
  history: boolean[]; // last 14 days
}

interface Props {
  streak: StreakData;
}

const WEEK_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

export default function StreakCard({ streak }: Props) {
  const last7 = streak.history.slice(-7);
  const remaining = Math.max(1, streak.best - streak.current + 1);

  return (
    <LinearGradient
      colors={['#FBF6EA', '#F5DCB6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.top}>
        <View style={styles.flameBox}>
          <FlameIcon size={30} color="#FBF6EA" />
        </View>
        <View style={styles.info}>
          <View style={styles.streakRow}>
            <Text style={styles.streakNum}>{streak.current}</Text>
            <Text style={styles.streakLabel}>일 연속</Text>
          </View>
          <Text style={styles.streakSub}>최고 기록 {streak.best}일 · 올해 {streak.thisYear}개의 일기</Text>
        </View>
      </View>

      <View style={styles.weekRow}>
        {last7.map((wrote, i) => {
          const isToday = i === 6;
          return (
            <View key={i} style={styles.dayCol}>
              <View style={[
                styles.dayBox,
                wrote ? styles.dayDone : styles.dayEmpty,
                isToday && styles.dayToday,
              ]}>
                {wrote && <CheckIcon size={12} color="#FBF6EA" />}
              </View>
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                {WEEK_LABELS[i]}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.goalRow}>
        <Text style={styles.goalText}>
          {remaining}일 더 쓰면{' '}
          <Text style={styles.goalHighlight}>최고 기록</Text>을 갱신해요.
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 18,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PAL.lineSoft,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  flameBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: PAL.amberDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  streakNum: {
    fontSize: 38,
    fontWeight: '600',
    color: PAL.indigoDeep,
    lineHeight: 42,
    letterSpacing: -0.5,
  },
  streakLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: PAL.indigoDeep,
  },
  streakSub: {
    marginTop: 4,
    fontSize: 12,
    color: 'rgba(31,27,58,0.7)',
    letterSpacing: -0.1,
  },
  weekRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  dayBox: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 36,
  },
  dayDone: {
    backgroundColor: 'rgba(168,106,44,0.85)',
  },
  dayEmpty: {
    backgroundColor: 'rgba(31,27,58,0.08)',
  },
  dayToday: {
    borderWidth: 2,
    borderColor: PAL.indigoDeep,
  },
  dayLabel: {
    fontSize: 10,
    color: 'rgba(31,27,58,0.55)',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  dayLabelToday: {
    color: PAL.indigoDeep,
    fontWeight: '600',
  },
  goalRow: {
    marginTop: 12,
    padding: 10,
    backgroundColor: 'rgba(31,27,58,0.06)',
    borderRadius: 10,
  },
  goalText: {
    fontSize: 12,
    color: PAL.indigoDeep,
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  goalHighlight: {
    color: PAL.amberDeep,
    fontWeight: '600',
  },
});
