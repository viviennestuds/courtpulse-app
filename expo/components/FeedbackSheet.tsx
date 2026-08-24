import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Check, AlertTriangle, Send, MessageSquare } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useFeedback } from '@/providers/FeedbackProvider';
import { FeedbackSubmissionError } from '@/services/feedback';
import {
  FEEDBACK_IDEMPOTENCY_PAYLOAD_MISMATCH_CODE,
  FEEDBACK_TYPE_OPTIONS,
  FeedbackType,
} from '@/types/feedback';
import { useResponsiveLayout } from '@/components/ResponsiveLayout';

export default function FeedbackSheet() {
  const insets = useSafeAreaInsets();
  const { modalSheetStyle } = useResponsiveLayout();
  const {
    isOpen,
    presetType,
    presetTitle,
    closeFeedback,
    submitAsync,
    isSubmitting,
    isSuccess,
    isError,
    error,
    lastSubmission,
    reset,
  } = useFeedback();

  const [type, setType] = useState<FeedbackType>(presetType);
  const [title, setTitle] = useState<string>(presetTitle);
  const [description, setDescription] = useState<string>('');
  const [expected, setExpected] = useState<string>('');
  const [actual, setActual] = useState<string>('');
  const [repro, setRepro] = useState<string>('');
  const [testerName, setTesterName] = useState<string>('');
  const [testerContact, setTesterContact] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setType(presetType);
      setTitle(presetTitle);
      setDescription('');
      setExpected('');
      setActual('');
      setRepro('');
      setTesterName('');
      setTesterContact('');
      setValidationError('');
      reset();
    }
  }, [isOpen, presetType, presetTitle, reset]);

  const isBug = type === 'bug';

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    if (!title.trim()) {
      setValidationError('Please add a short title.');
      return;
    }
    if (!description.trim()) {
      setValidationError('Please add a description.');
      return;
    }
    setValidationError('');
    try {
      await submitAsync({
        type,
        title: title.trim(),
        description: description.trim(),
        expectedBehavior: expected.trim() || undefined,
        actualBehavior: actual.trim() || undefined,
        reproSteps: repro.trim() || undefined,
        testerName: testerName.trim() || undefined,
        testerContact: testerContact.trim() || undefined,
      });
    } catch (e) {
      console.warn('[FeedbackSheet] submit failed', e);
    }
  }, [isSubmitting, type, title, description, expected, actual, repro, testerName, testerContact, submitAsync]);

  const handleDone = useCallback(() => {
    closeFeedback();
  }, [closeFeedback]);

  const displayError = useMemo(() => {
    if (validationError) return validationError;
    if (isError) {
      if (
        error instanceof FeedbackSubmissionError
        && error.code === FEEDBACK_IDEMPOTENCY_PAYLOAD_MISMATCH_CODE
      ) {
        return error.message;
      }
      return __DEV__ && error instanceof Error
        ? error.message
        : 'Feedback could not be sent. Please try again.';
    }
    return '';
  }, [validationError, isError, error]);

  const handleRequestClose = useCallback(() => {
    if (!isSubmitting) closeFeedback();
  }, [closeFeedback, isSubmitting]);

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      transparent
      onRequestClose={handleRequestClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleRequestClose} disabled={isSubmitting} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.kbWrap, modalSheetStyle]}
        >
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
            <View style={styles.grabberWrap}>
              <View style={styles.grabber} />
            </View>

            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <MessageSquare size={18} color={Colors.primary} />
                <Text style={styles.headerTitle}>Send Feedback</Text>
              </View>
              <TouchableOpacity
                onPress={handleRequestClose}
                hitSlop={10}
                testID="feedback-close"
                disabled={isSubmitting}
                style={isSubmitting ? styles.closeDisabled : undefined}
              >
                <X size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {isSuccess ? (
              <View style={styles.successWrap}>
                <View style={styles.successIconWrap}>
                  <Check size={28} color={Colors.positive} />
                </View>
                <Text style={styles.successTitle}>Feedback sent</Text>
                <Text style={styles.successSubtitle}>
                  Your report was saved. The CourtPulse team will take a look.
                </Text>
                {lastSubmission?.feedbackReference ? (
                  <Text style={styles.feedbackReference}>{lastSubmission.feedbackReference}</Text>
                ) : null}
                <TouchableOpacity style={styles.primaryBtn} onPress={handleDone} testID="feedback-done">
                  <Text style={styles.primaryBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                <Text style={styles.label}>Type</Text>
                <View style={styles.typeGrid}>
                  {FEEDBACK_TYPE_OPTIONS.map(opt => {
                    const selected = opt.value === type;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        onPress={() => setType(opt.value)}
                        style={[styles.typeChip, selected && styles.typeChipSelected]}
                        testID={`feedback-type-${opt.value}`}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.typeChipText, selected && styles.typeChipTextSelected]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>Title</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Short summary"
                  placeholderTextColor={Colors.textMuted}
                  testID="feedback-title"
                  maxLength={120}
                />

                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.multiline]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="What happened? What were you trying to do?"
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  testID="feedback-description"
                  maxLength={2000}
                />

                {isBug && (
                  <>
                    <Text style={styles.label}>Expected Behavior</Text>
                    <TextInput
                      style={[styles.input, styles.multiline]}
                      value={expected}
                      onChangeText={setExpected}
                      placeholder="What did you expect to happen?"
                      placeholderTextColor={Colors.textMuted}
                      multiline
                      testID="feedback-expected"
                      maxLength={800}
                    />

                    <Text style={styles.label}>Actual Behavior</Text>
                    <TextInput
                      style={[styles.input, styles.multiline]}
                      value={actual}
                      onChangeText={setActual}
                      placeholder="What actually happened?"
                      placeholderTextColor={Colors.textMuted}
                      multiline
                      testID="feedback-actual"
                      maxLength={800}
                    />

                    <Text style={styles.label}>Steps to Reproduce</Text>
                    <TextInput
                      style={[styles.input, styles.multiline]}
                      value={repro}
                      onChangeText={setRepro}
                      placeholder="1. …\n2. …"
                      placeholderTextColor={Colors.textMuted}
                      multiline
                      testID="feedback-repro"
                      maxLength={1200}
                    />
                  </>
                )}

                <View style={styles.rowSplit}>
                  <View style={styles.col}>
                    <Text style={styles.labelTight}>Your Name (optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={testerName}
                      onChangeText={setTesterName}
                      placeholder="Name"
                      placeholderTextColor={Colors.textMuted}
                      testID="feedback-name"
                      maxLength={80}
                    />
                  </View>
                  <View style={styles.col}>
                    <Text style={styles.labelTight}>Contact (optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={testerContact}
                      onChangeText={setTesterContact}
                      placeholder="Email or @handle"
                      placeholderTextColor={Colors.textMuted}
                      autoCapitalize="none"
                      testID="feedback-contact"
                      maxLength={120}
                    />
                  </View>
                </View>

                <Text style={styles.footnote}>
                  App version, current screen, and active filters are attached automatically.
                </Text>

                {displayError ? (
                  <View style={styles.errorRow}>
                    <AlertTriangle size={14} color={Colors.warning} />
                    <Text style={styles.errorText}>{displayError}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[styles.primaryBtn, isSubmitting && styles.primaryBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  activeOpacity={0.85}
                  testID="feedback-submit"
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <>
                      <Send size={14} color={Colors.white} />
                      <Text style={styles.primaryBtnText}>
                        {isError ? 'Retry' : 'Submit'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  kbWrap: {
    width: '100%',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    paddingHorizontal: Spacing.lg,
    maxHeight: '92%',
  },
  grabberWrap: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.cardBorder,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  closeDisabled: {
    opacity: 0.45,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  scrollContent: {
    paddingBottom: Spacing.lg,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  labelTight: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.8,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
  },
  multiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  typeChip: {
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  typeChipSelected: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  typeChipText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  typeChipTextSelected: {
    color: Colors.primary,
  },
  rowSplit: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  col: {
    flex: 1,
  },
  footnote: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: Spacing.md,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.warningMuted,
  },
  errorText: {
    color: Colors.warning,
    fontSize: FontSize.sm,
    flex: 1,
  },
  primaryBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  successWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  successIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.positiveMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  successTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  successSubtitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
  feedbackReference: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.8,
  },
});
