import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Wifi, Server, Database, FlaskConical } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { DataSource } from '@/services/dataProvider';

interface DataSourceBadgeProps {
  source: DataSource;
  compact?: boolean;
}

function getSourceConfig(source: DataSource): { label: string; color: string; bg: string; icon: 'wifi' | 'server' | 'database' | 'flask' } {
  switch (source) {
    case 'live':
      return { label: 'LIVE DATA', color: Colors.positive, bg: Colors.positiveMuted, icon: 'wifi' };
    case 'backend':
      return { label: 'BACKEND', color: Colors.secondary, bg: Colors.secondaryMuted, icon: 'server' };
    case 'fallback':
      return { label: 'FALLBACK', color: Colors.warning, bg: Colors.warningMuted, icon: 'database' };
    case 'demo':
      return { label: 'SAMPLE DATA', color: Colors.accent, bg: Colors.accentMuted, icon: 'flask' };
  }
}

const IconMap = {
  wifi: Wifi,
  server: Server,
  database: Database,
  flask: FlaskConical,
} as const;

export default React.memo(function DataSourceBadge({ source, compact = false }: DataSourceBadgeProps) {
  const config = getSourceConfig(source);
  const Icon = IconMap[config.icon];

  if (compact) {
    return (
      <View style={[styles.compactBadge, { backgroundColor: config.bg }]}>
        <Icon size={8} color={config.color} />
        <Text style={[styles.compactText, { color: config.color }]}>{config.label}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.badge, { backgroundColor: config.bg, borderColor: config.color + '30' }]}>
      <Icon size={10} color={config.color} />
      <Text style={[styles.text, { color: config.color }]}>{config.label}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 8,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.8,
  },
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  compactText: {
    fontSize: 7,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
});
