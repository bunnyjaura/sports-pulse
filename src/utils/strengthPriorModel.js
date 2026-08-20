import { computeLeagueStrength } from './leagueStrengthEngine.js';
import { getCanonicalTeamId } from './teamIdentity.js';

// Static prior Elo-style ratings for teams that frequently lack history
// Values approximate ClubElo / UEFA club strength (mid-2026)
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

const DEFAULT_ELO = 1450; // mid-table European average
const HOME_ADVANTAGE = 65; // typical home Elo boost

export function predictStrengthPriorMatch({
  homeTeam = '',
  awayTeam = '',
  leagueHome = 'ENG_PL',
  leagueAway = 'ENG_PL',
  kickoffAt = null
}) {
  const homeId = getCanonicalTeamId(homeTeam);
  const awayId = getCanonicalTeamId(awayTeam);

  const homeElo = TEAM_PRIOR_ELO[homeId] ?? DEFAULT_ELO;
  const awayElo = TEAM_PRIOR_ELO[awayId] ?? DEFAULT_ELO;

  // League strength adjustment
  const league = computeLeagueStrength(leagueHome, leagueAway);
  const leagueAdj = (league.differential || 0) * 80; // scale differential to Elo points

  const eloDiff = (homeElo + HOME_ADVANTAGE + leagueAdj) - awayElo;

  // Logistic conversion matching ensemble surrogate model
  const zHome = 0.22 + (0.0038 * eloDiff);
  const zDraw = -0.35 - (0.0005 * Math.abs(eloDiff));
  const zAway = -0.15 - (0.0036 * eloDiff);

  const expH = Math.exp(zHome);
  const expD = Math.exp(zDraw);
  const expA = Math.exp(zAway);
  const sum = expH + expD + expA;

  const probabilities = {
    home: expH / sum,
    draw: expD / sum,
    away: expA / sum
  };

  const predictedOutcome = probabilities.home >= probabilities.draw && probabilities.home >= probabilities.away
    ? 'Home'
    : (probabilities.draw >= probabilities.away ? 'Draw' : 'Away');

  // Simple xG estimate from Elo difference
  const homeXg = Math.round((1.35 + (eloDiff / 400)) * 100) / 100;
  const awayXg = Math.round((1.15 - (eloDiff / 450)) * 100) / 100;

  return {
    status: 'SUCCESS',
    probabilities,
    predictedOutcome,
    expectedGoals: {
      home: Math.max(0.4, Math.min(3.2, homeXg)),
      away: Math.max(0.3, Math.min(2.8, awayXg))
    },
    eloDiff,
    homePriorElo: homeElo,
    awayPriorElo: awayElo,
    leagueStrength: league,
    reasonCode: 'STRENGTH_PRIOR_USED',
    message: 'Zero historical matches. Prediction based on league strength + static team priors + home advantage.',
    confidence: 'LOW',
    generatedAt: new Date().toISOString()
  };
}
