import { getCanonicalTeamId } from './teamIdentity.js';
import { computeLeagueStrength } from './leagueStrengthEngine.js';

// Static Prior Map for select prominent European clubs
const TEAM_PRIOR_ELO = {
  celtic: 1569,
  lask_linz: 1428,
  lask: 1428,
  rangers: 1540,
  salzburg: 1555,
  shakhtar_donetsk: 1520,
  dynamo_kyiv: 1500,
  olympiacos: 1515,
  panathinaikos: 1480,
  paok: 1490,
  aek_athens: 1485,
  bodo_glimt: 1510,
  malmo: 1475,
  copenhagen: 1525,
  sparta_prague: 1510,
  slavia_prague: 1530,
  ferencvaros: 1470,
  red_star_belgrade: 1505,
  partizan: 1460,
  basel: 1485,
  young_boys: 1510
};

export const GLOBAL_DEFAULT_ELO = 1450;

/**
 * Computes pre-kickoff hierarchical prior rating for a team strictly using t < T data.
 *
 * Priority Ladder:
 * 1. Historical Team Elo (if N >= 1) -> HISTORICAL_DATA
 * 2. Static Prior Map (if present) -> STATIC_TEAM_PRIOR
 * 3. Competition / League Pre-Kickoff Average Elo -> PRE_MATCH_LEAGUE_AVERAGE
 * 4. Country / League Strength Coefficient -> LEAGUE_STRENGTH_COEFFICIENT
 * 5. Global Default Baseline (1450) -> GLOBAL_BASELINE_DEFAULT
 */
export function getPreMatchPrior({
  teamName = '',
  leagueId = 'ENG_PL',
  eloDb = {},
  leagueEloSums = {},
  leagueEloCounts = {}
}) {
  const teamId = getCanonicalTeamId(teamName);

  // Level 1: Team History Elo
  if (teamId && eloDb[teamId] !== undefined) {
    return { elo: eloDb[teamId], source: 'HISTORICAL_DATA', isHistorical: true };
  }

  // Level 2: Static Prior Map
  if (teamId && TEAM_PRIOR_ELO[teamId] !== undefined) {
    return { elo: TEAM_PRIOR_ELO[teamId], source: 'STATIC_TEAM_PRIOR', isHistorical: false };
  }

  // Level 3: Competition Pre-Kickoff Average Elo
  if (leagueId && leagueEloCounts[leagueId] && leagueEloCounts[leagueId] > 0) {
    const avgLgElo = Math.round(leagueEloSums[leagueId] / leagueEloCounts[leagueId]);
    return { elo: avgLgElo, source: 'PRE_MATCH_LEAGUE_AVERAGE', isHistorical: false };
  }

  // Level 4: Country / League Strength Coefficient
  const lgInfo = computeLeagueStrength(leagueId, leagueId);
  if (lgInfo && lgInfo.ratingHome !== undefined) {
    const scaledElo = Math.round(GLOBAL_DEFAULT_ELO + (lgInfo.ratingHome - 0.5) * 200);
    return { elo: scaledElo, source: 'LEAGUE_STRENGTH_COEFFICIENT', isHistorical: false };
  }

  // Level 5: Global Default Baseline
  return { elo: GLOBAL_DEFAULT_ELO, source: 'GLOBAL_BASELINE_DEFAULT', isHistorical: false };
}
