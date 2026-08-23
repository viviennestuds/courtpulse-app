import { useCallback, useMemo, useState } from 'react';
import type { LayoutChangeEvent, ViewStyle } from 'react-native';
import { useWindowDimensions } from 'react-native';
import {
  classifyResponsiveWidth,
  ResponsiveLayout,
  type ResponsiveTier,
} from '@/utils/responsiveLayout';

export { classifyResponsiveWidth, ResponsiveLayout } from '@/utils/responsiveLayout';
export type { ResponsiveTier } from '@/utils/responsiveLayout';

export interface ResponsiveLayoutState {
  tier: ResponsiveTier;
  viewportWidth: number;
  isCompact: boolean;
  isWide: boolean;
  frameStyle: ViewStyle;
  modalSheetStyle: ViewStyle | undefined;
}

export interface MeasuredContentWidth {
  width: number;
  onLayout: (event: LayoutChangeEvent) => void;
}

/** Returns shared page and sheet constraints without introducing platform-specific screens. */
export function useResponsiveLayout(): ResponsiveLayoutState {
  const { width: viewportWidth } = useWindowDimensions();
  const tier = classifyResponsiveWidth(viewportWidth);

  const frameStyle = useMemo<ViewStyle>(() => ({
    width: '100%',
    maxWidth: ResponsiveLayout.contentMaxWidth,
    alignSelf: 'center',
  }), []);

  const modalSheetStyle = useMemo<ViewStyle | undefined>(() => {
    if (tier === 'compact') return undefined;
    return {
      width: '100%',
      maxWidth: ResponsiveLayout.modalMaxWidth,
      alignSelf: 'center',
    };
  }, [tier]);

  return {
    tier,
    viewportWidth,
    isCompact: tier === 'compact',
    isWide: tier === 'wide',
    frameStyle,
    modalSheetStyle,
  };
}

/** Measures the real RN layout width so visualizations never need browser viewport geometry. */
export function useMeasuredContentWidth(): MeasuredContentWidth {
  const [width, setWidth] = useState<number>(0);

  const onLayout = useCallback((event: LayoutChangeEvent): void => {
    const nextWidth = Math.max(0, Math.round(event.nativeEvent.layout.width));
    setWidth((currentWidth: number) => currentWidth === nextWidth ? currentWidth : nextWidth);
  }, []);

  return { width, onLayout };
}
