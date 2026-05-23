export const Colors = {
  background: '#0A0E17',
  surface: '#111827',
  surfaceLight: '#1A2233',
  cardBg: '#141B2D',
  cardBorder: '#1E293B',
  divider: '#1E293B',

  primary: '#3B82F6',
  primaryMuted: 'rgba(59,130,246,0.15)',
  secondary: '#06B6D4',
  secondaryMuted: 'rgba(6,182,212,0.15)',
  accent: '#8B5CF6',
  accentMuted: 'rgba(139,92,246,0.15)',

  positive: '#10B981',
  positiveMuted: 'rgba(16,185,129,0.15)',
  negative: '#EF4444',
  negativeMuted: 'rgba(239,68,68,0.15)',
  warning: '#F59E0B',
  warningMuted: 'rgba(245,158,11,0.15)',

  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  white: '#FFFFFF',
  black: '#000000',

  glass: 'rgba(20,27,45,0.85)',
  glassBorder: 'rgba(255,255,255,0.08)',
  overlay: 'rgba(0,0,0,0.6)',
} as const;

export default {
  light: {
    text: Colors.textPrimary,
    background: Colors.background,
    tint: Colors.primary,
    tabIconDefault: Colors.textMuted,
    tabIconSelected: Colors.primary,
  },
};
