/**
 * Stat Trace / Formula Audit Registry types.
 *
 * Read-only, observational structures used to expose how a derived stat
 * was computed (formula, inputs, displayed vs computed value, confidence).
 *
 * These types are intentionally decoupled from any specific UI surface so
 * they can later be reused by a glossary, validation layer, or external
 * benchmarking (e.g. PBPStats) without touching consumer code.
 */

export type StatTraceSource = 'boxscore' | 'pbp' | 'derived';

export type StatTraceConfidence = 'high' | 'medium' | 'low';

export type StatTraceInput = {
  key: string;
  label: string;
  value: number;
};

export type StatTrace = {
  statKey: string;
  label: string;
  displayedValue: number | string;
  computedValue: number | null;
  formula: string;
  inputs: StatTraceInput[];
  source: StatTraceSource;
  confidence: StatTraceConfidence;
  notes?: string[];
};

export type StatTraceRegistry = Record<string, StatTrace>;
