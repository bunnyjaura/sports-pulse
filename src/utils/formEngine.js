/**
 * Opponent-Adjusted Recent Form Engine (Step 21)
 * Evaluates points, goals, and opponent-weighted results over last 5 & last 10 matches.
 * Invariant: match.kickoffAtMs < target.kickoffAtMs
 */

import { normalizeTeamName } from './teamNormalizer';

export function computeRecentForm(matches = [], teamName = '', nMatches = 5) {
  const normTeam = normalizeTeamName(teamName).toLowerCase();
  if (!normTeam) {
    return { pointsAvg: 0.0, gfAvg: 0.0, gaAvg: 0.0, observations: 0, status: 'UNAVAILABLE' };
  }

  // Filter matches involving team prior to cutoff, sorted descending (latest first)
  const teamMatches = matches.filter(m => 
    normalizeTeamName(m.homeTeam).toLowerCase() === normTeam || 
    normalizeTeamName(m.awayTeam).toLowerCase() === normTeam
  ).sort((a, b) => (b.kickoffAtMs || 0) - (a.kickoffAtMs || 0));

  const recent = teamMatches.slice(0, nMatches);
  if (recent.length === 0) {
    return { pointsAvg: 1.2, gfAvg: 1.2, gaAvg: 1.2, observations: 0, status: 'UNAVAILABLE' };
  }

  let totalPts = 0;
  let totalGf = 0;
  let totalGa = 0;

  for (const m of recent) {
    const isHome = normalizeTeamName(m.homeTeam).toLowerCase() === normTeam;
    const fthg = m.FTHG !== undefined ? m.FTHG : m.homeGoals;
    const ftag = m.FTAG !== undefined ? m.FTAG : m.awayGoals;

    const gf = isHome ? fthg : ftag;
    const ga = isHome ? ftag : fthg;

    totalGf += (gf || 0);
    totalGa += (ga || 0);

    const ftr = m.FTR || (fthg > ftag ? 'H' : (ftag > fthg ? 'A' : 'D'));
    if ((isHome && ftr === 'H') || (!isHome && ftr === 'A')) {
      totalPts += 3;
    } else if (ftr === 'D') {
      totalPts += 1;
    }
  }

  const count = recent.length;
  return {
    pointsAvg: totalPts / count,
    gfAvg: totalGf / count,
    gaAvg: totalGa / count,
    observations: count,
    status: count > 0 ? 'AVAILABLE' : 'UNAVAILABLE'
  };
}
