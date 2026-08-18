/**
 * Opponent Strength Tier Engine (Step 21)
 * Classifies pre-match opponents into STRONG, MEDIUM, and WEAK tiers.
 */

import { normalizeTeamName } from './teamNormalizer';
import { computeEloDatabase } from './eloEngine';

export function computeOpponentTierPerformance(matches = [], teamName = '', cutoff = null) {
  const normTeam = normalizeTeamName(teamName).toLowerCase();
  if (!normTeam) {
    return { vsStrong: 0, vsMedium: 0, vsWeak: 0, observations: 0, status: 'UNAVAILABLE' };
  }

  const eloDb = computeEloDatabase(matches, cutoff);
  const teamMatches = matches.filter(m => 
    normalizeTeamName(m.homeTeam).toLowerCase() === normTeam || 
    normalizeTeamName(m.awayTeam).toLowerCase() === normTeam
  );

  let vsStrongPts = 0, strongCount = 0;
  let vsMedPts = 0, medCount = 0;
  let vsWeakPts = 0, weakCount = 0;

  for (const m of teamMatches) {
    const isHome = normalizeTeamName(m.homeTeam).toLowerCase() === normTeam;
    const oppName = isHome ? m.awayTeam : m.homeTeam;
    const oppElo = eloDb[normalizeTeamName(oppName)] || 1500;

    const fthg = m.FTHG !== undefined ? m.FTHG : m.homeGoals;
    const ftag = m.FTAG !== undefined ? m.FTAG : m.awayGoals;
    const ftr = m.FTR || (fthg > ftag ? 'H' : (ftag > fthg ? 'A' : 'D'));

    let pts = 0;
    if ((isHome && ftr === 'H') || (!isHome && ftr === 'A')) pts = 3;
    else if (ftr === 'D') pts = 1;

    if (oppElo >= 1650) {
      vsStrongPts += pts;
      strongCount++;
    } else if (oppElo >= 1450) {
      vsMedPts += pts;
      medCount++;
    } else {
      vsWeakPts += pts;
      weakCount++;
    }
  }

  return {
    vsStrong: strongCount > 0 ? vsStrongPts / strongCount : 1.0,
    vsMedium: medCount > 0 ? vsMedPts / medCount : 1.3,
    vsWeak: weakCount > 0 ? vsWeakPts / weakCount : 2.0,
    observations: teamMatches.length,
    status: teamMatches.length > 0 ? 'AVAILABLE' : 'UNAVAILABLE'
  };
}
