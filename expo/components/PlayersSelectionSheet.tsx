import React, { useCallback } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';

export interface PlayersSelectionOption {
  value: string;
  label: string;
  detail?: string;
}

interface PlayersSelectionSheetProps {
  visible: boolean;
  title: string;
  options: PlayersSelectionOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  testID: string;
}

function PlayersSelectionSheetImpl({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
  testID,
}: PlayersSelectionSheetProps) {
  const insets = useSafeAreaInsets();

  const renderOption = useCallback(({ item }: { item: PlayersSelectionOption }) => {
    const isSelected = item.value === selectedValue;
    return (
      <TouchableOpacity
        style={[styles.option, isSelected && styles.optionSelected]}
        onPress={() => {
          onSelect(item.value);
          onClose();
        }}
        activeOpacity={0.72}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        testID={`${testID}-option-${item.value}`}
      >
        <View style={styles.optionCopy}>
          <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>{item.label}</Text>
          {item.detail ? <Text style={styles.optionDetail}>{item.detail}</Text> : null}
        </View>
        <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
          {isSelected ? <Check size={15} strokeWidth={3} color={Colors.background} /> : null}
        </View>
      </TouchableOpacity>
    );
  }, [onClose, onSelect, selectedValue, testID]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} testID={testID}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}
          onPress={() => undefined}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={`Close ${title}`}
              testID={`${testID}-close`}
            >
              <X size={19} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={options}
            renderItem={renderOption}
            keyExtractor={(item) => item.value}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default React.memo(PlayersSelectionSheetImpl);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(2, 6, 15, 0.76)',
  },
  sheet: {
    maxHeight: '72%',
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderTopWidth: 1,
    borderColor: Colors.glassBorder,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    ...(Platform.OS === 'web' ? { width: '100%' as const, alignSelf: 'center' as const, maxWidth: 560 } : null),
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.cardBorder,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  header: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    marginBottom: Spacing.xs,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.2,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
  },
  list: { flexGrow: 0 },
  option: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  optionSelected: { backgroundColor: Colors.primaryMuted, borderRadius: BorderRadius.md },
  optionCopy: { flex: 1 },
  optionLabel: { color: Colors.textSecondary, fontSize: FontSize.lg, fontWeight: FontWeight.medium },
  optionLabelSelected: { color: Colors.textPrimary, fontWeight: FontWeight.bold },
  optionDetail: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
});
