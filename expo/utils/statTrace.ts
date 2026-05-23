/**
 * Stat Trace builders.
 *
 * Each builder takes the already-computed inputs that the rest of the app
 * uses and returns a {@link StatTrace} describing the formula, inputs, and
 * computed value. Builders never recompute base stats from scratch — they
 * only describe how a derived value was produced so it can be audited.
 */
import type {
  StatTrace,
  StatTraceConfidence,
  StatTraceInput,
} from '@/types/statTrace';

const DEFAULT_SOURCE = 'derived' as const;

function safeDiv(num: number, den: number): number | null {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  return num / den;
}

export function getStatConfidence(args: {
  possessions: number;
  offPossessions: number;
}): StatTraceConfidence {
  const { possessions, offPossessions } = args;
  if (possessions >= 50 && offPossessions >= 20) return 'high';
  if (possessions >= 25 && offPossessions >= 10) return 'medium';
  return 'low';
}

export function buildOffensiveRatingTrace(args: {
  pointsFor: number;
  possessions: number;
  displayedValue: number;
  confidence?: StatTraceConfidence;
}): StatTrace {
  const { pointsFor, possessions, displayedValue, confidence = 'medium' } = args;
  const ratio = safeDiv(pointsFor, possessions);
  const computedValue = ratio === null ? null : ratio * 100;
  const inputs: StatTraceInput[] = [
    { key: 'pointsFor', label: 'Points For', value: pointsFor },
    { key: 'possessions', label: 'Possessions', value: possessions },
  ];
  return {
    statKey: 'offRtg',
    label: 'Offensive Rating',
    displayedValue,
    computedValue,
    formula: 'Points For / Possessions × 100',
    inputs,
    source: DEFAULT_SOURCE,
    confidence,
  };
}

export function buildDefensiveRatingTrace(args: {
  pointsAgainst: number;
  possessions: number;
  displayedValue: number;
  confidence?: StatTraceConfidence;
}): StatTrace {
  const { pointsAgainst, possessions, displayedValue, confidence = 'medium' } = args;
  const ratio = safeDiv(pointsAgainst, possessions);
  const computedValue = ratio === null ? null : ratio * 100;
  const inputs: StatTraceInput[] = [
    { key: 'pointsAgainst', label: 'Points Against', value: pointsAgainst },
    { key: 'possessions', label: 'Possessions', value: possessions },
  ];
  return {
    statKey: 'defRtg',
    label: 'Defensive Rating',
    displayedValue,
    computedValue,
    formula: 'Points Against / Possessions × 100',
    inputs,
    source: DEFAULT_SOURCE,
    confidence,
  };
}

export function buildNetRatingTrace(args: {
  offRtg: number;
  defRtg: number;
  displayedValue: number;
  confidence?: StatTraceConfidence;
}): StatTrace {
  const { offRtg, defRtg, displayedValue, confidence = 'medium' } = args;
  const computedValue = Number.isFinite(offRtg) && Number.isFinite(defRtg)
    ? offRtg - defRtg
    : null;
  const inputs: StatTraceInput[] = [
    { key: 'offRtg', label: 'Offensive Rating', value: offRtg },
    { key: 'defRtg', label: 'Defensive Rating', value: defRtg },
  ];
  return {
    statKey: 'netRtg',
    label: 'Net Rating',
    displayedValue,
    computedValue,
    formula: 'Offensive Rating - Defensive Rating',
    inputs,
    source: DEFAULT_SOURCE,
    confidence,
  };
}

export function buildOnOffTrace(args: {
  onNet: number;
  offNet: number;
  displayedValue: number;
  confidence?: StatTraceConfidence;
}): StatTrace {
  const { onNet, offNet, displayedValue, confidence = 'medium' } = args;
  const computedValue = Number.isFinite(onNet) && Number.isFinite(offNet)
    ? onNet - offNet
    : null;
  const inputs: StatTraceInput[] = [
    { key: 'onNet', label: 'ON Net', value: onNet },
    { key: 'offNet', label: 'OFF Net', value: offNet },
  ];
  return {
    statKey: 'onOffNet',
    label: 'On/Off Net',
    displayedValue,
    computedValue,
    formula: 'ON Net - OFF Net',
    inputs,
    source: DEFAULT_SOURCE,
    confidence,
  };
}

/**
 * PPO (Points Per Opportunity) — scoring efficiency stat.
 *
 * Defined as Points / True Shot Attempts where
 *   True Shot Attempts = FGA + 0.44 × FTA.
 *
 * This is NOT the same as points per possession.
 */
export function buildPpoTrace(args: {
  points: number;
  fga: number;
  fta: number;
  displayedValue: number;
  confidence?: StatTraceConfidence;
}): StatTrace {
  const { points, fga, fta, displayedValue, confidence = 'medium' } = args;
  const tsa = fga + 0.44 * fta;
  const computedValue = safeDiv(points, tsa);
  const inputs: StatTraceInput[] = [
    { key: 'points', label: 'Points', value: points },
    { key: 'fga', label: 'FGA', value: fga },
    { key: 'fta', label: 'FTA', value: fta },
    { key: 'tsa', label: 'True Shot Attempts (FGA + 0.44 × FTA)', value: tsa },
  ];
  return {
    statKey: 'ppo',
    label: 'PPO',
    displayedValue,
    computedValue,
    formula: 'Points / (FGA + 0.44 × FTA)',
    inputs,
    source: DEFAULT_SOURCE,
    confidence,
    notes: [
      'This is a scoring-efficiency stat and is not the same as points per possession.',
    ],
  };
}

/** Tolerance for displayed-vs-computed comparison per stat key. */
export const STAT_TRACE_TOLERANCE: Record<string, number> = {
  offRtg: 0.5,
  defRtg: 0.5,
  netRtg: 0.5,
  onOffNet: 0.5,
  ppo: 0.01,
};

export function statTraceHasDrift(trace: StatTrace): boolean {
  if (trace.computedValue === null) return false;
  const displayed = typeof trace.displayedValue === 'number'
    ? trace.displayedValue
    : Number(trace.displayedValue);
  if (!Number.isFinite(displayed)) return false;
  const tolerance = STAT_TRACE_TOLERANCE[trace.statKey] ?? 0.5;
  return Math.abs(displayed - trace.computedValue) > tolerance;
}
