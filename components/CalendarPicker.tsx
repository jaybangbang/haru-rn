import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { PAL } from '@/constants/palette';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

interface Props {
  selectedDate: Date;
  entryDates: Set<string>; // 'YYYY.MM.DD'
  onSelect: (date: Date) => void;
}

function toKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

export default function CalendarPicker({ selectedDate, entryDates, onSelect }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedKey = toKey(selectedDate);
  const todayKey = toKey(today);
  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  const goMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  return (
    <View style={styles.container}>
      {/* 월 네비게이션 */}
      <View style={styles.header}>
        <Pressable onPress={() => goMonth(-1)} hitSlop={12} style={styles.navBtn}>
          <Text style={styles.navText}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{viewYear}년 {viewMonth + 1}월</Text>
        <Pressable
          onPress={() => !isCurrentMonth && goMonth(1)}
          hitSlop={12}
          style={styles.navBtn}
          disabled={isCurrentMonth}
        >
          <Text style={[styles.navText, isCurrentMonth && styles.navDisabled]}>›</Text>
        </Pressable>
      </View>

      {/* 요일 헤더 */}
      <View style={styles.dowRow}>
        {DOW.map(d => (
          <View key={d} style={styles.cell}>
            <Text style={styles.dowText}>{d}</Text>
          </View>
        ))}
      </View>

      {/* 날짜 그리드 */}
      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (!day) return <View key={`e-${i}`} style={styles.cell} />;

          const cellDate = new Date(viewYear, viewMonth, day);
          cellDate.setHours(0, 0, 0, 0);
          const cellKey = toKey(cellDate);
          const isFuture = cellDate > today;
          const isSelected = cellKey === selectedKey;
          const isToday = cellKey === todayKey;
          const hasEntry = entryDates.has(cellKey);

          return (
            <Pressable
              key={cellKey}
              style={styles.cell}
              onPress={() => !isFuture && onSelect(cellDate)}
              disabled={isFuture}
            >
              <View style={[
                styles.dayCircle,
                isSelected && styles.circleSelected,
                !isSelected && hasEntry && styles.circleEntry,
                isToday && !isSelected && styles.circleToday,
              ]}>
                <Text style={[
                  styles.dayText,
                  isSelected && styles.textSelected,
                  !isSelected && hasEntry && styles.textEntry,
                  isToday && !isSelected && styles.textToday,
                  isFuture && styles.textFuture,
                ]}>
                  {day}
                </Text>
                {hasEntry && !isSelected && (
                  <View style={styles.dot} />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const CELL_SIZE = 40;

const styles = StyleSheet.create({
  container: {
    backgroundColor: PAL.paper,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PAL.lineSoft,
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  navBtn: { padding: 4 },
  navText: { fontSize: 22, color: PAL.ink, lineHeight: 26 },
  navDisabled: { opacity: 0.2 },
  monthLabel: {
    fontSize: 15, fontWeight: '600', color: PAL.ink,
  },
  dowRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 3,
  },
  dowText: {
    fontSize: 11,
    color: PAL.muted,
    fontWeight: '500',
  },
  dayCircle: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleSelected: {
    backgroundColor: PAL.indigoDeep,
  },
  circleEntry: {
    backgroundColor: 'rgba(168,106,44,0.12)',
  },
  circleToday: {
    borderWidth: 1.5,
    borderColor: PAL.indigoDeep,
  },
  dayText: {
    fontSize: 14,
    color: PAL.ink,
    fontWeight: '400',
  },
  textSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  textEntry: {
    color: PAL.amberDeep,
    fontWeight: '600',
  },
  textToday: {
    color: PAL.indigoDeep,
    fontWeight: '700',
  },
  textFuture: {
    opacity: 0.2,
  },
  dot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: PAL.amberDeep,
  },
});
