import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';

interface SegmentControlProps {
  segments: string[];
  selected: number;
  onSelect: (index: number) => void;
  semantics?: 'tabs' | 'selection';
}

export default React.memo(function SegmentControl({ segments, selected, onSelect, semantics = 'tabs' }: SegmentControlProps) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const handlePress = useCallback((index: number) => {
    onSelect(index);
  }, [onSelect]);

  return (
    <View style={styles.container} accessibilityRole={semantics === 'tabs' ? 'tablist' : undefined}>
      {segments.map((seg, i) => {
        const isSelected = selected === i;
        const isFocused = focusedIndex === i;
        return (
          <Pressable
            key={seg}
            style={({ pressed }: { pressed: boolean }) => [
              styles.segment,
              isSelected && styles.segmentActive,
              isFocused && styles.segmentFocused,
              pressed && styles.segmentPressed,
            ]}
            onPress={() => handlePress(i)}
            onFocus={() => setFocusedIndex(i)}
            onBlur={() => setFocusedIndex((current: number | null) => current === i ? null : current)}
            focusable
            accessibilityRole={semantics === 'tabs' ? 'tab' : 'button'}
            accessibilityLabel={seg}
            accessibilityState={{ selected: isSelected }}
          >
            <Text style={[styles.segmentText, isSelected && styles.segmentTextActive]}>
              {seg}
            </Text>
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
    borderRadius: BorderRadius.md,
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  segmentActive: {
    backgroundColor: Colors.primaryMuted,
  },
  segmentFocused: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  segmentPressed: {
    opacity: 0.72,
  },
  segmentText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  segmentTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
});
