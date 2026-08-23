import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';

interface SubTabBarProps {
  tabs: string[];
  selected: number;
  onSelect: (index: number) => void;
  compact?: boolean;
}

export default React.memo(function SubTabBar({ tabs, selected, onSelect, compact }: SubTabBarProps) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  return (
    <View style={[styles.container, compact && styles.containerCompact]} accessibilityRole="tablist">
      {tabs.map((tab, i) => {
        const isActive = selected === i;
        return (
          <Pressable
            key={tab}
            style={({ pressed }: { pressed: boolean }) => [
              styles.tab,
              isActive && styles.tabActive,
              compact && styles.tabCompact,
              focusedIndex === i && styles.tabFocused,
              pressed && styles.tabPressed,
            ]}
            onPress={() => onSelect(i)}
            onFocus={() => setFocusedIndex(i)}
            onBlur={() => setFocusedIndex((current: number | null) => current === i ? null : current)}
            focusable
            accessibilityRole="tab"
            accessibilityLabel={tab}
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive, compact && styles.tabTextCompact]}>
              {tab}
            </Text>
            {isActive && <View style={styles.indicator} />}
          </Pressable>
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
    paddingVertical: Spacing.sm - 2,
    alignItems: 'center',
    borderRadius: BorderRadius.sm - 1,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative' as const,
  },
  tabActive: {
    backgroundColor: Colors.surfaceLight,
  },
  tabFocused: {
    borderColor: Colors.primary,
  },
  tabPressed: {
    opacity: 0.72,
  },
  tabCompact: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    paddingVertical: Spacing.md - 2,
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
