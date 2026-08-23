import { describe, expect, test } from 'bun:test';
import {
  ResponsiveLayout,
  classifyResponsiveWidth,
  getGutteredModalWidth,
  getMeasuredChartGeometry,
} from '../utils/responsiveLayout';

describe('CourtPulse responsive layout', () => {
  test('classifies compact, medium, and wide boundaries deterministically', () => {
    expect(classifyResponsiveWidth(390)).toBe('compact');
    expect(classifyResponsiveWidth(ResponsiveLayout.compactMaxWidth)).toBe('compact');
    expect(classifyResponsiveWidth(768)).toBe('medium');
    expect(classifyResponsiveWidth(ResponsiveLayout.mediumMaxWidth)).toBe('medium');
    expect(classifyResponsiveWidth(1200)).toBe('wide');
    expect(classifyResponsiveWidth(1440)).toBe('wide');
  });

  test('keeps one deliberate content and modal width policy', () => {
    expect(ResponsiveLayout.contentMaxWidth).toBe(880);
    expect(ResponsiveLayout.modalMaxWidth).toBe(620);
    expect(ResponsiveLayout.analyticalModalMaxWidth).toBe(1040);
    expect(ResponsiveLayout.pageGutter).toBe(16);
  });

  test('gives analytical sheets viewport gutters before applying the wide cap', () => {
    expect(getGutteredModalWidth(390, ResponsiveLayout.analyticalModalMaxWidth)).toBe(358);
    expect(getGutteredModalWidth(768, ResponsiveLayout.analyticalModalMaxWidth)).toBe(736);
    expect(getGutteredModalWidth(1024, ResponsiveLayout.analyticalModalMaxWidth)).toBe(992);
    expect(getGutteredModalWidth(1440, ResponsiveLayout.analyticalModalMaxWidth)).toBe(1040);
  });

  test('scales the court and FT overlay from the same measured width', () => {
    const geometry = getMeasuredChartGeometry(848, 500, 470, 190);
    expect(geometry.width).toBe(848);
    expect(geometry.height).toBeCloseTo(797.12, 2);
    expect(geometry.freeThrowCenterY).toBeCloseTo(322.24, 2);
  });
});
