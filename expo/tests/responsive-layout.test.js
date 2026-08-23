import { describe, expect, test } from 'bun:test';
import {
  ResponsiveLayout,
  classifyResponsiveWidth,
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
    expect(ResponsiveLayout.pageGutter).toBe(16);
  });

  test('scales the court and FT overlay from the same measured width', () => {
    const geometry = getMeasuredChartGeometry(848, 500, 470, 190);
    expect(geometry.width).toBe(848);
    expect(geometry.height).toBeCloseTo(797.12, 2);
    expect(geometry.freeThrowCenterY).toBeCloseTo(322.24, 2);
  });
});
