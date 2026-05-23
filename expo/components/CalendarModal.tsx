import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, X, CalendarDays } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { formatGameDate, getTodayDateString } from '@/services/nbaApi';

interface CalendarModalProps {
  visible: boolean;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onClose: () => void;
  testId?: string;
}

interface DayCell {
  key: string;
  date: Date;
  dayNum: number;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

function parseDateString(d: string): Date {
  const parts = d.split('-');
  const year = parseInt(parts[0] ?? '', 10);
  const month = parseInt(parts[1] ?? '', 10);
  const day = parseInt(parts[2] ?? '', 10);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0, 0);
}

function CalendarModalImpl({ visible, selectedDate, onSelectDate, onClose, testId }: CalendarModalProps) {
  const insets = useSafeAreaInsets();
  const todayStr = getTodayDateString();

  const selectedAsDate = useMemo(() => parseDateString(selectedDate), [selectedDate]);
  const [viewMonth, setViewMonth] = useState<Date>(() => startOfMonth(selectedAsDate));

  useEffect(() => {
    if (visible) {
      setViewMonth(startOfMonth(parseDateString(selectedDate)));
    }
  }, [visible, selectedDate]);

  const cells = useMemo<DayCell[]>(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const first = new Date(year, month, 1, 12, 0, 0, 0);
    const startWeekday = first.getDay();
    const lastOfMonth = new Date(year, month + 1, 0, 12, 0, 0, 0).getDate();
    const out: DayCell[] = [];

    for (let i = 0; i < startWeekday; i++) {
      const d = new Date(year, month, 1 - (startWeekday - i), 12, 0, 0, 0);
      const key = formatGameDate(d);
      out.push({
        key,
        date: d,
        dayNum: d.getDate(),
        inMonth: false,
        isToday: key === todayStr,
        isSelected: key === selectedDate,
      });
    }

    for (let day = 1; day <= lastOfMonth; day++) {
      const d = new Date(year, month, day, 12, 0, 0, 0);
      const key = formatGameDate(d);
      out.push({
        key,
        date: d,
        dayNum: day,
        inMonth: true,
        isToday: key === todayStr,
        isSelected: key === selectedDate,
      });
    }

    const tail = (7 - (out.length % 7)) % 7;
    for (let i = 1; i <= tail; i++) {
      const d = new Date(year, month + 1, i, 12, 0, 0, 0);
      const key = formatGameDate(d);
      out.push({
        key,
        date: d,
        dayNum: i,
        inMonth: false,
        isToday: key === todayStr,
        isSelected: key === selectedDate,
      });
    }

    return out;
  }, [viewMonth, selectedDate, todayStr]);

  const monthLabel = useMemo(() => {
    return viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [viewMonth]);

  const goPrevMonth = useCallback(() => {
    setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1, 12, 0, 0, 0));
  }, []);

  const goNextMonth = useCallback(() => {
    setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1, 12, 0, 0, 0));
  }, []);

  const handleDayPress = useCallback((cell: DayCell) => {
    console.log('[CalendarModal] selected', cell.key);
    onSelectDate(cell.key);
    onClose();
  }, [onSelectDate, onClose]);

  const handleToday = useCallback(() => {
    console.log('[CalendarModal] jump to today', todayStr);
    onSelectDate(todayStr);
    onClose();
  }, [onSelectDate, onClose, todayStr]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID={testId}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]} onPress={() => { /* swallow */ }}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <CalendarDays size={18} color={Colors.primary} />
              <Text style={styles.title}>Pick a Date</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} testID="calendar-modal-close">
              <X size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.monthNav}>
            <TouchableOpacity style={styles.navBtn} onPress={goPrevMonth} testID="calendar-prev-month">
              <ChevronLeft size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <TouchableOpacity style={styles.navBtn} onPress={goNextMonth} testID="calendar-next-month">
              <ChevronRight size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((w, i) => (
              <Text key={`${w}-${i}`} style={styles.weekdayLabel}>{w}</Text>
            ))}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.gridScroll}>
            <View style={styles.grid}>
              {cells.map(cell => {
                const isSel = cell.isSelected;
                const isToday = cell.isToday;
                return (
                  <TouchableOpacity
                    key={cell.key}
                    activeOpacity={0.6}
                    onPress={() => handleDayPress(cell)}
                    style={styles.cellWrap}
                    testID={`calendar-cell-${cell.key}`}
                  >
                    <View
                      style={[
                        styles.cell,
                        isToday && !isSel && styles.cellToday,
                        isSel && styles.cellSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.cellText,
                          !cell.inMonth && styles.cellTextMuted,
                          isSel && styles.cellTextSelected,
                          isToday && !isSel && styles.cellTextToday,
                        ]}
                      >
                        {cell.dayNum}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.todayBtn} onPress={handleToday} activeOpacity={0.75} testID="calendar-jump-today">
            <Text style={styles.todayBtnText}>Jump to Today</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default React.memo(CalendarModalImpl);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: 1,
    borderColor: Colors.cardBorder,
    ...(Platform.OS === 'web' ? { maxHeight: '90%' } : null),
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.cardBorder,
    marginBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.3,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
  },
  gridScroll: {
    maxHeight: 320,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cellWrap: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 3,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: 'transparent',
  },
  cellToday: {
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  cellSelected: {
    backgroundColor: Colors.primary,
  },
  cellText: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  cellTextMuted: {
    color: Colors.textMuted,
    opacity: 0.45,
  },
  cellTextSelected: {
    color: '#fff',
    fontWeight: FontWeight.bold,
  },
  cellTextToday: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  todayBtn: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  todayBtnText: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
});
