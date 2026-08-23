import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { useFeatureFlags } from '@/providers/FeatureFlagsProvider';
import {
  setRouteObservabilityContext,
  setStabilityObservabilityContext,
} from '@/services/observability';

/** Keeps global route and stability context synchronized without changing navigation behavior. */
export default function ObservabilityBridge() {
  const pathname = usePathname();
  const { channel } = useFeatureFlags();

  useEffect(() => {
    setRouteObservabilityContext(pathname);
  }, [pathname]);

  useEffect(() => {
    setStabilityObservabilityContext(channel);
  }, [channel]);

  return null;
}
