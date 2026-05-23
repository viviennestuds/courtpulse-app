import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { formatGameDate, getTodayDateString } from '@/services/nbaApi';

interface DateRailProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  daysBefore?: number;
  daysAfter?: number;
  testId?: string;
}

interface DateCell {
  key: string;
  date: Date;
  weekday: string;
  dayNum: string;
  monthAbbr: string;
  isToday: boolean;
  isSelected: boolean;
}

const CELL_WIDTH = 60;
const CELL_GAP = 8;

function startOfDay(d: Date): Date {
  const nd = new Date(d);
  nd.setHours(0, 0, 0, 0);
  return nd;
}

function DateRailImpl({ selectedDate, onSelectDate, daysBefore = 14, daysAfter = 7, testId }: DateRailProps) {
  const scrollRef = useRef<ScrollView>(null);
  const todayStr = getTodayDateString();

  const cells = useMemo<DateCell[]>(() => {
    const out: DateCell[] = [];
    const today = startOfDay(new Date());
    for (let i = -daysBefore; i <= daysAfter; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const key = formatGameDate(d);
      out.push({
        key,
        date: d,
        weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
        dayNum: String(d.getDate()),
        monthAbbr: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
        isToday: key === todayStr,
        isSelected: key === selectedDate,
      });
    }
    return out;
  }, [daysBefore, daysAfter, selectedDate, todayStr]);

  const selectedIndex = useMemo(() => cells.findIndex(c => c.isSelected), [cells]);

  useEffect(() => {
    if (selectedIndex < 0) return;
    const offset = Math.max(0, selectedIndex * (CELL_WIDTH + CELL_GAP) - Spacing.lg * 2);
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: offset, animated: true });
    }, 50);
    return () => clearTimeout(t);
  }, [selectedIndex]);

  const handlePress = useCallback((date: string) => {
    console.log('[DateRail] selected', date);
    onSelectDate(date);
  }, [onSelectDate]);

  return (
    <View style={styles.wrap} testID={testId}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        decelerationRate="fast"
      >
        {cells.map(cell => {
          const isSel = cell.isSelected;
          return (
            <TouchableOpacity
              key={cell.key}
              activeOpacity={0.7}
              onPress={() => handlePress(cell.key)}
              style={[
                styles.cell,
                isSel && styles.cellSelected,
                cell.isToday && !isSel && styles.cellToday,
              ]}
              testID={`date-rail-cell-${cell.key}`}
            >
              <Text style={[styles.weekday, isSel && styles.weekdaySelected]}>
                {cell.isToday ? 'TODAY' : cell.weekday}
              </Text>
              <Text style={[styles.dayNum, isSel && styles.dayNumSelected]}>{cell.dayNum}</Text>
              <Text style={[styles.month, isSel && styles.monthSelected]}>{cell.monthAbbr}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default React.memo(DateRailImpl);

const styles = StyleSheet.create({
  wrap: {
    marginBottom: Spacing.lg,
    marginHorizontal: -Spacing.lg,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: CELL_GAP,
    ...(Platform.OS === 'web' ? { paddingBottom: 2 } : null),
  },
  cell: {
    width: CELL_WIDTH,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  cellToday: {
    borderColor: Colors.primary,
  },
  cellSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  weekday: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
    marginBottom: 4,
  },
  weekdaySelected: {
    color: 'rgba(255,255,255,0.85)',
  },
  dayNum: {
    color: Colors.textPrimary,
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.heavy,
    lineHeight: FontSize.xxl + 2,
  },
  dayNumSelected: {
    color: '#fff',
  },
  month: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.semibold,
    letterSpacing: 1,
    marginTop: 2,
  },
  monthSelected: {
    color: 'rgba(255,255,255,0.85)',
  },
});
