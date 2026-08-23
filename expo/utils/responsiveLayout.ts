export type ResponsiveTier = 'compact' | 'medium' | 'wide';

export const ResponsiveLayout = {
  compactMaxWidth: 767,
  mediumMaxWidth: 1199,
  contentMaxWidth: 880,
  modalMaxWidth: 620,
  analyticalModalMaxWidth: 1040,
  pageGutter: 16,
} as const;

/** Classifies a viewport using CourtPulse's intentionally small breakpoint set. */
export function classifyResponsiveWidth(width: number): ResponsiveTier {
  if (width <= ResponsiveLayout.compactMaxWidth) return 'compact';
  if (width <= ResponsiveLayout.mediumMaxWidth) return 'medium';
  return 'wide';
}

/** Returns a centered sheet width capped by the selected policy and viewport gutters. */
export function getGutteredModalWidth(viewportWidth: number, maxWidth: number): number {
  const availableWidth = Math.max(0, viewportWidth - ResponsiveLayout.pageGutter * 2);
  return Math.min(availableWidth, maxWidth);
}

export interface MeasuredChartGeometry {
  width: number;
  height: number;
  freeThrowCenterY: number;
}

/** Scales chart and overlay geometry from one measured content width. */
export function getMeasuredChartGeometry(
  width: number,
  viewBoxWidth: number,
  viewBoxHeight: number,
  freeThrowViewBoxY: number,
): MeasuredChartGeometry {
  const safeWidth = Math.max(0, width);
  const scale = viewBoxWidth > 0 ? safeWidth / viewBoxWidth : 0;
  return {
    width: safeWidth,
    height: viewBoxHeight * scale,
    freeThrowCenterY: freeThrowViewBoxY * scale,
  };
}
