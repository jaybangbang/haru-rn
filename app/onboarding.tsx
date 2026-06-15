import React, { useRef, useState } from 'react';
import {
  View, Text, Image, Pressable, StyleSheet, Dimensions, FlatList,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PAL } from '@/constants/palette';
import { PERSONA_LIST } from '@/lib/personas';
import { ensureAuth } from '@/lib/auth';

const { width } = Dimensions.get('window');
const ONBOARDING_KEY = 'haru_onboarded';

const SLIDES = PERSONA_LIST.map(p => ({
  persona: p,
  headline: p.key === 'insighter'
    ? '당신의 일기에서\n패턴을 읽어요'
    : p.key === 'wit'
    ? '공감 한 마디로\n하루를 가볍게 해요'
    : '오늘의 감정을\n내일의 행동으로 바꿔요',
}));

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const goNext = async () => {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
      setIndex(index + 1);
    } else {
      await AsyncStorage.setItem(ONBOARDING_KEY, '1');
      await ensureAuth();
      router.replace('/(tabs)');
    }
  };

  const isLast = index === SLIDES.length - 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <Image source={item.persona.image} style={styles.avatar} />
            <View style={[styles.roleBadge, { backgroundColor: item.persona.color + '22' }]}>
              <Text style={[styles.roleText, { color: item.persona.color }]}>{item.persona.role}</Text>
            </View>
            <Text style={styles.name}>{item.persona.name}</Text>
            <Text style={styles.desc}>{item.persona.description}</Text>
            <Text style={styles.headline}>{item.headline}</Text>
          </View>
        )}
      />

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <Pressable style={[styles.btn, { backgroundColor: PAL.indigoDeep }]} onPress={goNext}>
        <Text style={styles.btnText}>{isLast ? '시작하기' : '다음'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAL.bg, alignItems: 'center' },
  slide: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 40,
    gap: 12,
  },
  avatar: {
    width: 120, height: 120, borderRadius: 60,
    marginBottom: 8,
  },
  roleBadge: {
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999,
  },
  roleText: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  name: {
    fontSize: 22, fontWeight: '600', color: PAL.ink,
    fontFamily: 'NotoSerifKR-Medium',
  },
  desc: {
    fontSize: 14, color: PAL.muted, textAlign: 'center', lineHeight: 22,
  },
  headline: {
    marginTop: 16,
    fontSize: 26, fontWeight: '400', color: PAL.ink,
    fontFamily: 'NotoSerifKR-Regular',
    textAlign: 'center', lineHeight: 40,
  },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 28 },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: PAL.line,
  },
  dotActive: { backgroundColor: PAL.indigoDeep, width: 18 },
  btn: {
    width: width - 48, paddingVertical: 16,
    borderRadius: 16, alignItems: 'center',
  },
  btnText: { color: PAL.bg, fontSize: 16, fontWeight: '600' },
});
