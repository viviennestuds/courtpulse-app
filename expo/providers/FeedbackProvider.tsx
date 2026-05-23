import React, { useCallback, useMemo, useRef, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { useMutation } from '@tanstack/react-query';
import { useFeatureFlags } from '@/providers/FeatureFlagsProvider';
import { buildFeedbackPayload, submitFeedback } from '@/services/feedback';
import type {
  FeedbackContextSnapshot,
  FeedbackFormInput,
  FeedbackType,
} from '@/types/feedback';

export interface OpenFeedbackOptions {
  type?: FeedbackType;
  context?: FeedbackContextSnapshot;
  title?: string;
}

export const [FeedbackProvider, useFeedback] = createContextHook(() => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [presetType, setPresetType] = useState<FeedbackType>('bug');
  const [presetTitle, setPresetTitle] = useState<string>('');
  const [overrideContext, setOverrideContext] = useState<FeedbackContextSnapshot | null>(null);
  const activeContextRef = useRef<FeedbackContextSnapshot>({});

  const { channel, resolved, overrides } = useFeatureFlags();

  const setActiveContext = useCallback((ctx: FeedbackContextSnapshot) => {
    activeContextRef.current = ctx;
  }, []);

  const mergeActiveContext = useCallback((partial: FeedbackContextSnapshot) => {
    activeContextRef.current = { ...activeContextRef.current, ...partial };
  }, []);

  const openFeedback = useCallback((options?: OpenFeedbackOptions) => {
    setPresetType(options?.type ?? 'bug');
    setPresetTitle(options?.title ?? '');
    setOverrideContext(options?.context ?? null);
    setIsOpen(true);
  }, []);

  const closeFeedback = useCallback(() => {
    setIsOpen(false);
  }, []);

  const resolveContext = useCallback((): FeedbackContextSnapshot => {
    const base = activeContextRef.current ?? {};
    const override = overrideContext ?? {};
    return {
      ...base,
      ...override,
      filters: { ...(base.filters ?? {}), ...(override.filters ?? {}) },
      extra: { ...(base.extra ?? {}), ...(override.extra ?? {}) },
    };
  }, [overrideContext]);

  const submitMutation = useMutation({
    mutationFn: async (form: FeedbackFormInput) => {
      const payload = buildFeedbackPayload({
        form,
        context: resolveContext(),
        flags: { channel, resolved, overrides },
      });
      const result = await submitFeedback(payload);
      if (!result.ok) throw new Error(result.error ?? 'Submission failed');
      return { payload, pasteUrl: result.pasteUrl };
    },
  });

  return useMemo(
    () => ({
      isOpen,
      presetType,
      presetTitle,
      openFeedback,
      closeFeedback,
      setActiveContext,
      mergeActiveContext,
      submit: submitMutation.mutate,
      submitAsync: submitMutation.mutateAsync,
      isSubmitting: submitMutation.isPending,
      isSuccess: submitMutation.isSuccess,
      isError: submitMutation.isError,
      error: submitMutation.error,
      reset: submitMutation.reset,
    }),
    [
      isOpen,
      presetType,
      presetTitle,
      openFeedback,
      closeFeedback,
      setActiveContext,
      mergeActiveContext,
      submitMutation.mutate,
      submitMutation.mutateAsync,
      submitMutation.isPending,
      submitMutation.isSuccess,
      submitMutation.isError,
      submitMutation.error,
      submitMutation.reset,
    ]
  );
});

export function useFeedbackContext(snapshot: FeedbackContextSnapshot) {
  const { setActiveContext } = useFeedback();
  const serialized = JSON.stringify(snapshot);
  React.useEffect(() => {
    setActiveContext(snapshot);
    return () => {
      setActiveContext({});
    };
  }, [serialized, setActiveContext]);
}
