/**
 * Team Strength Engine (Step 21)
 * Calculates pre-match team rating, goal scoring/conceding strength, and goal difference.
 * Invariant: match.kickoffAtMs < target.kickoffAtMs
 */

import { computeEloDatabase } from './eloEngine';
import { normalizeTeamName } from './teamNormalizer';

export function computeTeamStrength(matches = [], homeTeam = '', awayTeam = '', cutoff = null) {
  const normHome = normalizeTeamName(homeTeam);
  const normAway = normalizeTeamName(awayTeam);

  const eloDb = computeEloDatabase(matches, cutoff);
  const homeElo = eloDb[normHome] || 1500;
  const awayElo = eloDb[normAway] || 1500;

  // Calculate goal scoring & conceding averages over pre-cutoff matches
  const getGoalsStats = (team) => {
    const tNorm = team.toLowerCase();
    const teamMatches = matches.filter(m => 
      normalizeTeamName(m.homeTeam).toLowerCase() === tNorm || 
      normalizeTeamName(m.awayTeam).toLowerCase() === tNorm
    );

    if (teamMatches.length === 0) {
      return { gfAvg: 1.3, gaAvg: 1.3, gdAvg: 0.0, count: 0 };
    }

    let totalGf = 0;
    let totalGa = 0;

    for (const m of teamMatches) {
      const isHome = normalizeTeamName(m.homeTeam).toLowerCase() === tNorm;
      const gf = isHome ? (m.FTHG !== undefined ? m.FTHG : m.homeGoals) : (m.FTAG !== undefined ? m.FTAG : m.awayGoals);
      const ga = isHome ? (m.FTAG !== undefined ? m.FTAG : m.awayGoals) : (m.FTHG !== undefined ? m.FTHG : m.homeGoals);
      totalGf += (gf || 0);
      totalGa += (ga || 0);
    }

    const count = teamMatches.length;
    return {
      gfAvg: totalGf / count,
      gaAvg: totalGa / count,
      gdAvg: (totalGf - totalGa) / count,
      count
    };
  };

  const homeStats = getGoalsStats(normHome);
  const awayStats = getGoalsStats(normAway);

  return {
    home: {
      elo: homeElo,
      gfAvg: homeStats.gfAvg,
      gaAvg: homeStats.gaAvg,
      gdAvg: homeStats.gdAvg,
      observations: homeStats.count,
      status: homeStats.count > 0 ? 'AVAILABLE' : 'UNAVAILABLE'
    },
    away: {
      elo: awayElo,
      gfAvg: awayStats.gfAvg,
      gaAvg: awayStats.gaAvg,
      gdAvg: awayStats.gdAvg,
      observations: awayStats.count,
      status: awayStats.count > 0 ? 'AVAILABLE' : 'UNAVAILABLE'
    },
    eloDiff: homeElo - awayElo
  };
}
