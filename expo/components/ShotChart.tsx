import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Rect, Circle, Line, Path } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize } from '@/constants/theme';
import { CanonicalShotEvent } from '@/analytics/shots';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

interface ShotChartProps {
  shots: CanonicalShotEvent[];
  width: number;
  onShotPress?: (shot: CanonicalShotEvent) => void;
  selectedShotId?: string | null;
}

interface ChartPoint {
  cx: number;
  cy: number;
}

const COURT_VIEWBOX = {
  width: 500,
  height: 470,
} as const;

const COURT_V2_VIEWBOX = {
  width: 520,
  height: 500,
} as const;

const COURT_V2_ORIGIN = {
  x: 10,
  y: 12,
} as const;

const COURT_V2 = {
  sidelineLeft: 0,
  sidelineRight: 500,
  baseline: 0,
  halfCourt: 470,
  rimX: 250,
  rimY: 52.5,
  backboardY: 40,
  backboardLeft: 220,
  backboardRight: 280,
  paintLeft: 170,
  paintRight: 330,
  paintDepth: 190,
  restrictedRadius: 40,
  freeThrowCircleRadius: 60,
  threePointLeft: 30,
  threePointRight: 470,
  threePointCornerDepth: 142,
  threePointArcRadius: 237.5,
} as const;

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function mapShotToLegacySvgPoint(shot: CanonicalShotEvent): ChartPoint {
  const x = typeof shot.x === 'number' ? clampUnit(shot.x) : 0.5;
  const y = typeof shot.y === 'number' ? clampUnit(shot.y) : 0;
  return {
    cx: x * 440 + 30,
    cy: y * 420 + 10,
  };
}

function mapShotToCourtV2SvgPoint(shot: CanonicalShotEvent): ChartPoint {
  const x = typeof shot.x === 'number' ? clampUnit(shot.x) : 0.5;
  const y = typeof shot.y === 'number' ? clampUnit(shot.y) : 0;
  const nbaDistanceFromRim = y * COURT_VIEWBOX.height;
  const courtY = Math.min(COURT_V2.halfCourt, COURT_V2.rimY + nbaDistanceFromRim);

  return {
    cx: COURT_V2_ORIGIN.x + x * COURT_VIEWBOX.width,
    cy: COURT_V2_ORIGIN.y + courtY,
  };
}

function mapShotToLegacyHitPoint(shot: CanonicalShotEvent, width: number, svgHeight: number): ChartPoint {
  const x = typeof shot.x === 'number' ? clampUnit(shot.x) : 0.5;
  const y = typeof shot.y === 'number' ? clampUnit(shot.y) : 0;
  return {
    cx: x * (width - 60) + 30 * (width / COURT_VIEWBOX.width),
    cy: y * (svgHeight * 420 / COURT_VIEWBOX.height) + 10 * (svgHeight / COURT_VIEWBOX.height),
  };
}

function LegacyCourtGeometry() {
  return (
    <>
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
    </>
  );
}

function CourtGeometryV2() {
  const lineColor = 'rgba(148, 163, 184, 0.24)';
  const quietLineColor = 'rgba(148, 163, 184, 0.16)';
  const rimLineColor = 'rgba(203, 213, 225, 0.32)';
  const threePointColor = 'rgba(34, 211, 238, 0.46)';
  const laneFill = 'rgba(59, 130, 246, 0.025)';
  const x = (value: number): number => COURT_V2_ORIGIN.x + value;
  const y = (value: number): number => COURT_V2_ORIGIN.y + value;
  const threePointD = [
    `M ${x(COURT_V2.threePointLeft)} ${y(COURT_V2.baseline)}`,
    `L ${x(COURT_V2.threePointLeft)} ${y(COURT_V2.threePointCornerDepth)}`,
    `A ${COURT_V2.threePointArcRadius} ${COURT_V2.threePointArcRadius} 0 0 0 ${x(COURT_V2.threePointRight)} ${y(COURT_V2.threePointCornerDepth)}`,
    `L ${x(COURT_V2.threePointRight)} ${y(COURT_V2.baseline)}`,
  ].join(' ');
  const restrictedD = `M ${x(COURT_V2.rimX - COURT_V2.restrictedRadius)} ${y(COURT_V2.rimY)} A ${COURT_V2.restrictedRadius} ${COURT_V2.restrictedRadius} 0 0 0 ${x(COURT_V2.rimX + COURT_V2.restrictedRadius)} ${y(COURT_V2.rimY)}`;

  return (
    <>
      <Rect x="0" y="0" width={COURT_V2_VIEWBOX.width} height={COURT_V2_VIEWBOX.height} fill={Colors.surface} />
      <Rect x="0" y="0" width={COURT_V2_VIEWBOX.width} height={COURT_V2_VIEWBOX.height} fill="rgba(6, 182, 212, 0.018)" />

      <Line x1={x(COURT_V2.sidelineLeft)} y1={y(COURT_V2.baseline)} x2={x(COURT_V2.sidelineRight)} y2={y(COURT_V2.baseline)} stroke={lineColor} strokeWidth="1" />
      <Line x1={x(COURT_V2.sidelineLeft)} y1={y(COURT_V2.baseline)} x2={x(COURT_V2.sidelineLeft)} y2={y(COURT_V2.halfCourt)} stroke={quietLineColor} strokeWidth="1" />
      <Line x1={x(COURT_V2.sidelineRight)} y1={y(COURT_V2.baseline)} x2={x(COURT_V2.sidelineRight)} y2={y(COURT_V2.halfCourt)} stroke={quietLineColor} strokeWidth="1" />
      <Line x1={x(COURT_V2.sidelineLeft)} y1={y(COURT_V2.halfCourt)} x2={x(COURT_V2.sidelineRight)} y2={y(COURT_V2.halfCourt)} stroke="rgba(148, 163, 184, 0.13)" strokeWidth="1" />

      <Rect
        x={x(COURT_V2.paintLeft)}
        y={y(COURT_V2.baseline)}
        width={COURT_V2.paintRight - COURT_V2.paintLeft}
        height={COURT_V2.paintDepth}
        fill={laneFill}
        stroke={lineColor}
        strokeWidth="1"
      />
      <Line
        x1={x(COURT_V2.backboardLeft)}
        y1={y(COURT_V2.backboardY)}
        x2={x(COURT_V2.backboardRight)}
        y2={y(COURT_V2.backboardY)}
        stroke={rimLineColor}
        strokeWidth="1.5"
      />
      <Circle cx={x(COURT_V2.rimX)} cy={y(COURT_V2.rimY)} r="5.5" fill="none" stroke={rimLineColor} strokeWidth="1.25" />
      <Path d={restrictedD} fill="none" stroke="rgba(148, 163, 184, 0.18)" strokeWidth="1" />

      <Circle
        cx={x(COURT_V2.rimX)}
        cy={y(COURT_V2.paintDepth)}
        r={COURT_V2.freeThrowCircleRadius}
        fill="none"
        stroke={lineColor}
        strokeWidth="1"
      />
      <Line x1={x(COURT_V2.paintLeft)} y1={y(COURT_V2.paintDepth)} x2={x(COURT_V2.paintRight)} y2={y(COURT_V2.paintDepth)} stroke={lineColor} strokeWidth="1" />

      <Path
        d={threePointD}
        fill="none"
        stroke={threePointColor}
        strokeWidth="1.35"
      />
    </>
  );
}

export default React.memo(function ShotChart({ shots, width, onShotPress, selectedShotId }: ShotChartProps) {
  const enableCourtGeometryV2 = useFeatureFlag('enableShotChartCourtGeometryV2');
  const chartViewBox = enableCourtGeometryV2 ? COURT_V2_VIEWBOX : COURT_VIEWBOX;
  const svgScale = width / chartViewBox.width;
  const svgHeight = chartViewBox.height * svgScale;

  const plottableShots = useMemo(() => {
    return shots.filter(s => s.x != null && s.y != null);
  }, [shots]);

  const shotPositions = useMemo(() => {
    return plottableShots.map(shot => {
      if (!enableCourtGeometryV2) {
        return { shot, ...mapShotToLegacyHitPoint(shot, width, svgHeight) };
      }
      const svgPoint = mapShotToCourtV2SvgPoint(shot);
      return {
        shot,
        cx: svgPoint.cx * svgScale,
        cy: svgPoint.cy * svgScale,
      };
    });
  }, [plottableShots, enableCourtGeometryV2, width, svgHeight, svgScale]);

  const handleShotPress = useCallback((shot: CanonicalShotEvent) => {
    if (onShotPress) {
      console.log('[ShotChart] Shot tapped: id=%s player=%s result=%s', shot.id, shot.playerName, shot.result);
      onShotPress(shot);
    }
  }, [onShotPress]);

  return (
    <View style={styles.container}>
      <View style={[styles.courtContainer, { width, height: svgHeight }]}>
        <Svg width={width} height={svgHeight} viewBox={`0 0 ${chartViewBox.width} ${chartViewBox.height}`}>
          {enableCourtGeometryV2 ? <CourtGeometryV2 /> : <LegacyCourtGeometry />}

          {plottableShots.map((shot) => {
            const { cx, cy } = enableCourtGeometryV2 ? mapShotToCourtV2SvgPoint(shot) : mapShotToLegacySvgPoint(shot);
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
              const hitSize = 28;
              return (
                <TouchableOpacity
                  key={shot.id}
                  style={[
                    styles.shotHitTarget,
                    {
                      left: cx - hitSize / 2,
                      top: cy - hitSize / 2,
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
