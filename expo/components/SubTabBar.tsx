import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';

interface SubTabBarProps {
  tabs: string[];
  selected: number;
  onSelect: (index: number) => void;
  compact?: boolean;
}

export default React.memo(function SubTabBar({ tabs, selected, onSelect, compact }: SubTabBarProps) {
  const indicatorAnim = useRef(new Animated.Value(selected)).current;

  useEffect(() => {
    Animated.spring(indicatorAnim, {
      toValue: selected,
      useNativeDriver: false,
      speed: 24,
      bounciness: 0,
    }).start();
  }, [selected, indicatorAnim]);

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {tabs.map((tab, i) => {
        const isActive = selected === i;
        return (
          <TouchableOpacity
            key={i}
            style={[styles.tab, isActive && styles.tabActive, compact && styles.tabCompact]}
            onPress={() => onSelect(i)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive, compact && styles.tabTextCompact]}>
              {tab}
            </Text>
            {isActive && <View style={styles.indicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    padding: 2,
    gap: 1,
    marginBottom: Spacing.md,
  },
  containerCompact: {
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    borderRadius: 0,
    padding: 0,
    gap: 0,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.sm - 1,
    position: 'relative' as const,
  },
  tabActive: {
    backgroundColor: Colors.surfaceLight,
  },
  tabCompact: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    paddingVertical: Spacing.md,
  },
  tabText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.3,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  tabTextCompact: {
    fontSize: FontSize.sm,
  },
  indicator: {
    position: 'absolute' as const,
    bottom: 0,
    left: '20%' as unknown as number,
    right: '20%' as unknown as number,
    height: 2,
    backgroundColor: Colors.primary,
    borderRadius: 1,
  },
});
