import React, { useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';

interface SegmentControlProps {
  segments: string[];
  selected: number;
  onSelect: (index: number) => void;
}

export default React.memo(function SegmentControl({ segments, selected, onSelect }: SegmentControlProps) {
  const animatedValue = useRef(new Animated.Value(selected)).current;

  useEffect(() => {
    Animated.spring(animatedValue, {
      toValue: selected,
      useNativeDriver: false,
      speed: 20,
      bounciness: 0,
    }).start();
  }, [selected, animatedValue]);

  const handlePress = useCallback((index: number) => {
    onSelect(index);
  }, [onSelect]);

  return (
    <View style={styles.container}>
      {segments.map((seg, i) => (
        <TouchableOpacity
          key={i}
          style={[styles.segment, selected === i && styles.segmentActive]}
          onPress={() => handlePress(i)}
          activeOpacity={0.7}
        >
          <Text style={[styles.segmentText, selected === i && styles.segmentTextActive]}>
            {seg}
          </Text>
        </TouchableOpacity>
      ))}
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
