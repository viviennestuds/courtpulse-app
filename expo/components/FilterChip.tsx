import React, { useCallback } from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

export default React.memo(function FilterChip({ label, active, onPress }: FilterChipProps) {
  const handlePress = useCallback(() => {
    onPress();
  }, [onPress]);

  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  chipActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  text: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  textActive: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
});
