import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { EMOTION_COLOR } from '@/constants/palette';
import { Emotion } from '@/lib/types';

interface Props {
  emotion: Emotion;
  size?: 'sm' | 'lg';
}

export default function EmotionPill({ emotion, size = 'sm' }: Props) {
  const c = EMOTION_COLOR[emotion.key] || EMOTION_COLOR.default;
  const isLg = size === 'lg';
  return (
    <View style={[styles.pill, {
      paddingVertical: isLg ? 6 : 4,
      paddingHorizontal: isLg ? 12 : 9,
      backgroundColor: c + '1F', // ~12% opacity
    }]}>
      <Text style={{ fontSize: isLg ? 14 : 12 }}>{emotion.emoji}</Text>
      <Text style={[styles.label, { color: c, fontSize: isLg ? 13 : 11.5 }]}>
        {emotion.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
  },
  label: {
    fontWeight: '500',
    letterSpacing: -0.1,
  },
});
