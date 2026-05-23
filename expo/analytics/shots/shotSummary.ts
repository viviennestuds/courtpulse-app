import { CanonicalShotEvent, ShotQuerySummary } from './shotTypes';

export function summarizeShots(shots: CanonicalShotEvent[]): ShotQuerySummary {
  let fgMakes = 0;
  let fgMisses = 0;
  let ftMade = 0;
  let ftAttempted = 0;
  let points = 0;
  let twosMade = 0;
  let twosAttempted = 0;
  let threesMade = 0;
  let threesAttempted = 0;

  for (const shot of shots) {
    const isMake = shot.result === 'make';

    if (shot.shotZone === 'ft') {
      ftAttempted++;
      if (isMake) {
        ftMade++;
        points += 1;
      }
      continue;
    }

    if (shot.points === 3) {
      threesAttempted++;
      if (isMake) {
        threesMade++;
        fgMakes++;
        points += 3;
      } else {
        fgMisses++;
      }
    } else {
      twosAttempted++;
      if (isMake) {
        twosMade++;
        fgMakes++;
        points += 2;
      } else {
        fgMisses++;
      }
    }
  }

  const fgAttempted = fgMakes + fgMisses;
  const fgPct = fgAttempted > 0 ? Math.round((fgMakes / fgAttempted) * 1000) / 10 : null;
  const ftPct = ftAttempted > 0 ? Math.round((ftMade / ftAttempted) * 1000) / 10 : null;

  const scoringOpportunities = fgAttempted + 0.44 * ftAttempted;
  const ppo = scoringOpportunities > 0 ? Math.round((points / scoringOpportunities) * 100) / 100 : null;
  const tsPct = scoringOpportunities > 0 ? Math.round((points / (2 * scoringOpportunities)) * 1000) / 10 : null;

  return {
    attempts: fgAttempted,
    makes: fgMakes,
    misses: fgMisses,
    fgPct,
    points,
    twosMade,
    twosAttempted,
    threesMade,
    threesAttempted,
    ftMade,
    ftAttempted,
    ftPct,
    ppo,
    tsPct,
  };
}
