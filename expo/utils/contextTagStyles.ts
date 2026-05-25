import { Colors } from '@/constants/colors';

export type ContextTagFamily = 'game_state' | 'source_backed' | 'derived_possession' | 'special_ft_foul' | 'negative';

export interface ContextTagStyle {
  color: string;
  backgroundColor: string;
  family: ContextTagFamily;
}

function normalizeContextTagLabel(label: string): string {
  return label.trim().toLowerCase().replace(/[-_\s]+/g, ' ');
}

/**
 * Shared semantic color mapping for compact basketball context pills.
 * Keep this separate from official event-category colors.
 */
export function getContextTagStyle(label: string): ContextTagStyle {
  const normalized = normalizeContextTagLabel(label);

  if (normalized === 'clutch') {
    return { color: Colors.warning, backgroundColor: Colors.warningMuted, family: 'game_state' };
  }

  if (normalized === 'fast break' || normalized === '2nd chance' || normalized === 'second chance') {
    return { color: Colors.secondary, backgroundColor: Colors.secondaryMuted, family: 'source_backed' };
  }

  if (normalized === 'off turnover' || normalized === 'after timeout' || normalized === 'early offense' || normalized === 'after miss') {
    return { color: Colors.primary, backgroundColor: Colors.primaryMuted, family: 'derived_possession' };
  }

  if (
    normalized === 'and 1' ||
    normalized === 'and-1' ||
    normalized === 'technical' ||
    normalized === 'flagrant' ||
    normalized === 'clear path' ||
    normalized === 'defensive violation'
  ) {
    return { color: '#D97706', backgroundColor: 'rgba(217,119,6,0.13)', family: 'special_ft_foul' };
  }

  if (normalized === 'negative') {
    return { color: Colors.negative, backgroundColor: Colors.negativeMuted, family: 'negative' };
  }

  return { color: Colors.textSecondary, backgroundColor: Colors.surfaceLight, family: 'derived_possession' };
}
