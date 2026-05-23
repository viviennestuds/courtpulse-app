import { useFeatureFlags } from '@/providers/FeatureFlagsProvider';
import { FLAG_KEYS } from '@/constants/featureFlags';

export function useFeatureFlag(key: string): boolean {
  const { isEnabled } = useFeatureFlags();

  if (__DEV__ && !FLAG_KEYS.includes(key)) {
    console.warn(
      `[useFeatureFlag] Unknown flag key: "${key}". ` +
      `Available keys: ${FLAG_KEYS.join(', ')}. ` +
      `Add it to constants/featureFlags.ts to suppress this warning.`
    );
  }

  return isEnabled(key);
}
