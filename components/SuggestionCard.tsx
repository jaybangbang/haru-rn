import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { PAL } from '@/constants/palette';
import { PersonaKey } from '@/lib/types';
import { MagnifyIcon, BoltIcon, CompassIcon, ArrowRightIcon } from './Icons';

interface Suggestion {
  persona: PersonaKey;
  kind: string;
  title: string;
  body: string;
  metric: { label: string; value: string };
}

const TONE = {
  insighter: { accent: PAL.indigoDeep, accentBg: 'rgba(45,42,92,0.10)', Icon: MagnifyIcon },
  coach: { accent: '#4A5A38', accentBg: 'rgba(74,90,56,0.10)', Icon: CompassIcon },
  wit: { accent: PAL.amberDeep, accentBg: 'rgba(168,106,44,0.10)', Icon: BoltIcon },
};

export default function SuggestionCard({ s }: { s: Suggestion }) {
  const T = TONE[s.persona];
  return (
    <View style={[styles.card, { borderLeftColor: T.accent }]}>
      <View style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: T.accentBg }]}>
          <T.Icon size={12} color={T.accent} />
        </View>
        <Text style={[styles.kind, { color: T.accent }]}>{s.kind}</Text>
        <View style={{ flex: 1 }} />
        <View style={[styles.metricBadge, { backgroundColor: T.accentBg }]}>
          <Text style={[styles.metricText, { color: T.accent }]}>
            {s.metric.label} {s.metric.value}
          </Text>
        </View>
      </View>

      <Text style={styles.title}>{s.title}</Text>
      <Text style={styles.body}>{s.body}</Text>

      <View style={styles.footer}>
        <Pressable style={styles.moreBtn}>
          <Text style={[styles.moreText, { color: T.accent }]}>자세히 보기</Text>
          <ArrowRightIcon size={13} color={T.accent} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: PAL.paper,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: PAL.lineSoft,
    borderLeftWidth: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  iconBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kind: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  metricBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  metricText: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
    color: PAL.ink,
    lineHeight: 22,
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  body: {
    fontSize: 13.5,
    lineHeight: 22,
    color: 'rgba(31,27,58,0.75)',
    letterSpacing: -0.1,
  },
  footer: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  moreText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
});
