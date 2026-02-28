export const Colors = {
  background: '#0A0E1A',
  surface: '#141925',
  surfaceElevated: '#1C2333',
  surfacePressed: '#232B3E',
  border: '#2A3142',
  borderLight: '#353D52',

  primary: '#4F8CFF',
  primaryDark: '#3A6FD8',
  primaryLight: '#6BA0FF',
  primaryMuted: 'rgba(79, 140, 255, 0.12)',

  success: '#22C55E',
  successMuted: 'rgba(34, 197, 94, 0.12)',
  warning: '#F59E0B',
  warningMuted: 'rgba(245, 158, 11, 0.12)',
  danger: '#EF4444',
  dangerMuted: 'rgba(239, 68, 68, 0.12)',
  info: '#8B5CF6',
  infoMuted: 'rgba(139, 92, 246, 0.12)',
  cyan: '#06B6D4',
  cyanMuted: 'rgba(6, 182, 212, 0.12)',

  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  textInverse: '#0A0E1A',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

export const StatusColors: Record<string, { bg: string; text: string; dot: string }> = {
  New: { bg: Colors.primaryMuted, text: Colors.primary, dot: Colors.primary },
  Contacted: { bg: Colors.cyanMuted, text: Colors.cyan, dot: Colors.cyan },
  'Ready to Quote': { bg: Colors.infoMuted, text: Colors.info, dot: Colors.info },
  Quoted: { bg: Colors.warningMuted, text: Colors.warning, dot: Colors.warning },
  'Follow-Up': { bg: 'rgba(249, 115, 22, 0.12)', text: '#F97316', dot: '#F97316' },
  Closed: { bg: Colors.successMuted, text: Colors.success, dot: Colors.success },
  Lost: { bg: Colors.dangerMuted, text: Colors.danger, dot: Colors.danger },
  'Renewal Scheduled': { bg: 'rgba(168, 85, 247, 0.12)', text: '#A855F7', dot: '#A855F7' },
};
