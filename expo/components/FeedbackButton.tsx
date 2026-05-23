import React, { useCallback } from 'react';
import { TouchableOpacity, Text, StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { MessageSquare, Bug } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useFeedback } from '@/providers/FeedbackProvider';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import type { FeedbackContextSnapshot, FeedbackType } from '@/types/feedback';

export interface FeedbackButtonProps {
  variant?: 'pill' | 'icon' | 'row';
  label?: string;
  type?: FeedbackType;
  context?: FeedbackContextSnapshot;
  title?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export default function FeedbackButton({
  variant = 'pill',
  label,
  type = 'bug',
  context,
  title,
  style,
  testID,
}: FeedbackButtonProps) {
  const enabled = useFeatureFlag('feedback_reporting_enabled');
  const { openFeedback } = useFeedback();

  const handlePress = useCallback(() => {
    openFeedback({ type, context, title });
  }, [openFeedback, type, context, title]);

  if (!enabled) return null;

  const isBug = type === 'bug';
  const Icon = isBug ? Bug : MessageSquare;
  const resolvedLabel = label ?? (isBug ? 'Report Bug' : 'Send Feedback');

  if (variant === 'icon') {
    return (
      <TouchableOpacity
        onPress={handlePress}
        style={[styles.iconBtn, style]}
        activeOpacity={0.75}
        testID={testID ?? 'feedback-icon-btn'}
        accessibilityRole="button"
        accessibilityLabel={resolvedLabel}
      >
        <Icon size={16} color={Colors.textSecondary} />
      </TouchableOpacity>
    );
  }

  if (variant === 'row') {
    return (
      <TouchableOpacity
        onPress={handlePress}
        style={[styles.row, style]}
        activeOpacity={0.7}
        testID={testID ?? 'feedback-row-btn'}
      >
        <View style={styles.rowIcon}>
          <Icon size={16} color={Colors.primary} />
        </View>
        <Text style={styles.rowText}>{resolvedLabel}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[styles.pill, style]}
      activeOpacity={0.8}
      testID={testID ?? 'feedback-pill-btn'}
    >
      <Icon size={12} color={Colors.primary} />
      <Text style={styles.pillText}>{resolvedLabel}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  pillText: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.3,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
});
