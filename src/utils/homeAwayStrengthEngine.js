/**
 * Home / Away Strength Engine (Step 21)
 * Compares Home Team's Home record vs Away Team's Away record strictly prior to kickoff.
 */

import { normalizeTeamName } from './teamNormalizer';

export function computeHomeAwayStrength(matches = [], homeTeam = '', awayTeam = '') {
  const normHome = normalizeTeamName(homeTeam).toLowerCase();
  const normAway = normalizeTeamName(awayTeam).toLowerCase();

  const homeMatches = matches.filter(m => normalizeTeamName(m.homeTeam).toLowerCase() === normHome);
  const awayMatches = matches.filter(m => normalizeTeamName(m.awayTeam).toLowerCase() === normAway);

  const getRecord = (list, isHomeRecord) => {
    if (list.length === 0) return { winRate: 0.45, gfAvg: 1.5, gaAvg: 1.1, count: 0 };
    let wins = 0, gf = 0, ga = 0;
    for (const m of list) {
      const fthg = m.FTHG !== undefined ? m.FTHG : m.homeGoals;
      const ftag = m.FTAG !== undefined ? m.FTAG : m.awayGoals;
      const ftr = m.FTR || (fthg > ftag ? 'H' : (ftag > fthg ? 'A' : 'D'));

      if (isHomeRecord) {
        if (ftr === 'H') wins++;
        gf += (fthg || 0);
        ga += (ftag || 0);
      } else {
        if (ftr === 'A') wins++;
        gf += (ftag || 0);
        ga += (fthg || 0);
      }
    }
    const c = list.length;
    return { winRate: wins / c, gfAvg: gf / c, gaAvg: ga / c, count: c };
  };

  const hRec = getRecord(homeMatches, true);
  const aRec = getRecord(awayMatches, false);

  return {
    homeRecord: hRec,
    awayRecord: aRec,
    winRateDiff: hRec.winRate - aRec.winRate,
    status: (hRec.count > 0 || aRec.count > 0) ? 'AVAILABLE' : 'UNAVAILABLE'
  };
}
