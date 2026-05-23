import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Svg, { Rect, Circle, Line, Path } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { CanonicalShotEvent } from '@/analytics/shots';

interface ShotChartProps {
  shots: CanonicalShotEvent[];
  width: number;
  onShotPress?: (shot: CanonicalShotEvent) => void;
  selectedShotId?: string | null;
}

export default React.memo(function ShotChart({ shots, width, onShotPress, selectedShotId }: ShotChartProps) {
  const height = width * 0.94;

  const plottableShots = useMemo(() => {
    return shots.filter(s => s.x != null && s.y != null);
  }, [shots]);

  const shotPositions = useMemo(() => {
    return plottableShots.map(shot => {
      const cx = (shot.x as number) * (width - 60) + 30 * (width / 500);
      const cy = (shot.y as number) * (height * 420 / 470) + 10 * (height / 470);
      return { shot, cx, cy };
    });
  }, [plottableShots, width, height]);

  const handleShotPress = useCallback((shot: CanonicalShotEvent) => {
    if (onShotPress) {
      console.log('[ShotChart] Shot tapped: id=%s player=%s result=%s', shot.id, shot.playerName, shot.result);
      onShotPress(shot);
    }
  }, [onShotPress]);

  const svgScale = width / 500;
  const svgHeight = 470 * svgScale;

  return (
    <View style={styles.container}>
      <View style={[styles.courtContainer, { width, height: svgHeight }]}>
        <Svg width={width} height={svgHeight} viewBox="0 0 500 470">
          <Rect x="0" y="0" width="500" height="470" fill={Colors.surface} rx="8" />

          <Rect x="30" y="0" width="440" height="470" fill="none" stroke={Colors.cardBorder} strokeWidth="1.5" />
          <Rect x="170" y="0" width="160" height="190" fill="none" stroke={Colors.cardBorder} strokeWidth="1.5" />
          <Circle cx="250" cy="190" r="60" fill="none" stroke={Colors.cardBorder} strokeWidth="1.5" />
          <Rect x="200" y="0" width="100" height="60" fill="none" stroke={Colors.cardBorder} strokeWidth="1.5" />
          <Circle cx="250" cy="60" r="6" fill={Colors.cardBorder} />

          <Path
            d="M 30 0 L 30 160 C 30 290 470 290 470 160 L 470 0"
            fill="none"
            stroke={Colors.cardBorder}
            strokeWidth="1.5"
            strokeDasharray="6 4"
          />

          <Line x1="30" y1="0" x2="470" y2="0" stroke={Colors.cardBorder} strokeWidth="2" />

          {plottableShots.map((shot) => {
            const cx = (shot.x as number) * 440 + 30;
            const cy = (shot.y as number) * 420 + 10;
            const isMake = shot.result === 'make';
            const isSelected = selectedShotId === shot.id;
            return (
              <React.Fragment key={shot.id}>
                {isSelected && (
                  <Circle
                    cx={cx}
                    cy={cy}
                    r={12}
                    fill={Colors.primary + '30'}
                    stroke={Colors.primary}
                    strokeWidth={1.5}
                  />
                )}
                <Circle
                  cx={cx}
                  cy={cy}
                  r={isMake ? 6 : 5}
                  fill={isMake ? Colors.positive + '90' : 'transparent'}
                  stroke={isSelected ? Colors.primary : isMake ? Colors.positive : Colors.negative}
                  strokeWidth={isMake ? (isSelected ? 1.5 : 0) : 1.5}
                />
              </React.Fragment>
            );
          })}
        </Svg>

        {onShotPress && (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {shotPositions.map(({ shot, cx, cy }) => {
              const scaledCx = cx;
              const scaledCy = cy;
              const hitSize = 28;
              return (
                <TouchableOpacity
                  key={shot.id}
                  style={[
                    styles.shotHitTarget,
                    {
                      left: scaledCx - hitSize / 2,
                      top: scaledCy - hitSize / 2,
                      width: hitSize,
                      height: hitSize,
                    },
                  ]}
                  onPress={() => handleShotPress(shot)}
                  activeOpacity={0.6}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                />
              );
            })}
          </View>
        )}
      </View>
      {plottableShots.length === 0 && shots.length > 0 && (
        <Text style={styles.noCoordText}>Shot coordinates not available for chart rendering</Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  courtContainer: {
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  noCoordText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    textAlign: 'center' as const,
    fontStyle: 'italic' as const,
  },
  shotHitTarget: {
    position: 'absolute',
    borderRadius: 14,
  },
});
