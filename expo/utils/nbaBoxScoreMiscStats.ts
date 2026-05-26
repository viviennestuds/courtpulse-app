type StatSource = Record<string, unknown>;

const POINTS_OFF_TURNOVERS_KEYS: string[] = [
  'pointsOffTurnovers',
  'ptsOffTurnovers',
  'pointsOffTov',
  'ptsOffTov',
  'pointsFromTurnovers',
  'ptsFromTurnovers',
  'pointsOffTO',
  'ptsOffTO',
  'turnoversPoints',
  'pointsOffOpponentTurnovers',
  'pointsFromOpponentTurnovers',
  'opponentTurnoverPoints',
  'pointsOffTOV',
  'ptsOffTOV',
];

const TEAM_MISC_FIELD_KEYS: Record<string, string[]> = {
  pointsOffTurnovers: POINTS_OFF_TURNOVERS_KEYS,
  pointsSecondChance: ['pointsSecondChance', 'secondChancePoints', 'ptsSecondChance'],
  pointsFastBreak: ['pointsFastBreak', 'fastBreakPoints', 'FBPS', 'fbps'],
  pointsInThePaint: ['pointsInThePaint', 'PITP', 'pitp'],
  benchPoints: ['benchPoints', 'ptsBench', 'pointsBench'],
  personalFoulsDrawn: ['foulsDrawn', 'personalFoulsDrawn', 'PFD', 'pfd'],
  blockedAttempts: ['blocksReceived', 'blockedAttempts', 'BLKA', 'blka'],
  pointsAgainst: ['pointsAgainst'],
};

const PLAYER_MISC_FIELD_KEYS: Record<string, string[]> = {
  pointsSecondChance: ['pointsSecondChance', 'secondChancePoints', 'ptsSecondChance'],
  pointsFastBreak: ['pointsFastBreak', 'fastBreakPoints', 'FBPS', 'fbps'],
  pointsInThePaint: ['pointsInThePaint', 'PITP', 'pitp'],
  personalFoulsDrawn: ['foulsDrawn', 'personalFoulsDrawn', 'PFD', 'pfd'],
  blockedAttempts: ['blocksReceived', 'blockedAttempts', 'BLKA', 'blka'],
};

function pickSourceBackedNumber(source: StatSource, keys: string[]): number | undefined {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = source[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
  }
  return undefined;
}

function normalizeMiscStats(source: StatSource, fieldKeys: Record<string, string[]>): Record<string, number> {
  const normalized: Record<string, number> = {};
  for (const [normalizedKey, sourceKeys] of Object.entries(fieldKeys)) {
    const value = pickSourceBackedNumber(source, sourceKeys);
    if (value !== undefined) normalized[normalizedKey] = value;
  }
  return normalized;
}

/** Returns only official/source-backed team boxscore misc fields present in the NBA payload. */
export function normalizeTeamBoxScoreMiscStats(source: StatSource): Record<string, number> {
  return normalizeMiscStats(source, TEAM_MISC_FIELD_KEYS);
}

/** Returns only official/source-backed player boxscore misc fields present in the NBA payload. */
export function normalizePlayerBoxScoreMiscStats(source: StatSource): Record<string, number> {
  return normalizeMiscStats(source, PLAYER_MISC_FIELD_KEYS);
}

/** Source-field aliases audited for current and likely NBA boxscore misc payloads. */
export const nbaBoxScoreMiscSourceFields: Record<'team' | 'player', Record<string, string[]>> = {
  team: TEAM_MISC_FIELD_KEYS,
  player: PLAYER_MISC_FIELD_KEYS,
};
