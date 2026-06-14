import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { PAL } from '@/constants/palette';
import { DiaryEntry } from '@/lib/types';
import { CommentIcon } from './Icons';

interface Props {
  entry: DiaryEntry;
  onPress: () => void;
}

export default function EntryCard({ entry, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {/* date block */}
      <View style={styles.dateBlock}>
        <Text style={styles.dateDay}>{entry.dateObj.d}</Text>
        <Text style={styles.dateSub}>{entry.dateObj.m}월 · {entry.dateObj.dow}</Text>
      </View>

      {/* preview */}
      <View style={styles.preview}>
        <View style={styles.emotionRow}>
          {entry.emotions.slice(0, 2).map(em => (
            <Text key={em.key} style={styles.emotionText}>{em.emoji} {em.label}</Text>
          ))}
        </View>
        <Text style={styles.bodyText} numberOfLines={2}>{entry.preview}</Text>
      </View>

      {/* comment count */}
      <View style={styles.commentBlock}>
        <CommentIcon size={14} color={PAL.amberDeep} />
        <Text style={styles.commentCount}>{entry.comments?.length || 0}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: PAL.paper,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: PAL.lineSoft,
    minHeight: 80,
  },
  pressed: {
    opacity: 0.85,
  },
  dateBlock: {
    width: 52,
    alignItems: 'center',
    paddingVertical: 6,
    borderRightWidth: 1,
    borderRightColor: PAL.line,
    marginRight: 4,
  },
  dateDay: {
    fontSize: 22,
    fontWeight: '500',
    color: PAL.indigoDeep,
    lineHeight: 26,
  },
  dateSub: {
    marginTop: 4,
    fontSize: 10,
    color: PAL.muted,
    letterSpacing: 0.5,
  },
  preview: {
    flex: 1,
  },
  emotionRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 5,
  },
  emotionText: {
    fontSize: 10,
    color: PAL.muted,
    letterSpacing: 0.2,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 21,
    color: PAL.ink,
  },
  commentBlock: {
    alignItems: 'center',
    gap: 2,
  },
  commentCount: {
    fontSize: 11,
    color: PAL.muted,
    fontWeight: '500',
  },
});
