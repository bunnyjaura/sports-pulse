import { getCanonicalTeamId } from './teamIdentity';

// Dixon-Coles Poisson Expected Goals (xG) & Scoreline Matrix Engine

export function poissonProbability(k, lambda) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function factorial(n) {
  if (n <= 1) return 1;
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

// Dixon-Coles low-score interdependence correction tau
export function dixonColesTau(x, y, lambda, mu, rho = -0.13) {
  if (x === 0 && y === 0) return 1 - (lambda * mu * rho);
  if (x === 1 && y === 0) return 1 + (mu * rho);
  if (x === 0 && y === 1) return 1 + (lambda * rho);
  if (x === 1 && y === 1) return 1 - rho;
  return 1.0;
}

// Fit team attack & defense factors from historical match records up to cutoff date
export function trainDixonColesModel(matches, cutoffDate = null) {
  const teamStats = {};
  let totalHomeGoals = 0;
  let totalAwayGoals = 0;
  let matchCount = 0;

  const validMatches = matches.filter(m => {
    if (m.FTHG === undefined || m.FTAG === undefined) return false;
    if (cutoffDate && new Date(m.date) > new Date(cutoffDate)) return false;
    return true;
  });

  for (const m of validMatches) {
    const hId = m.homeTeamId || getCanonicalTeamId(m.homeTeam);
    const aId = m.awayTeamId || getCanonicalTeamId(m.awayTeam);
    if (!hId || !aId) continue;

    if (!teamStats[hId]) teamStats[hId] = { homeScored: 0, homeConceded: 0, homeGames: 0, awayScored: 0, awayConceded: 0, awayGames: 0 };
    if (!teamStats[aId]) teamStats[aId] = { homeScored: 0, homeConceded: 0, homeGames: 0, awayScored: 0, awayConceded: 0, awayGames: 0 };

    teamStats[hId].homeScored += m.FTHG;
    teamStats[hId].homeConceded += m.FTAG;
    teamStats[hId].homeGames += 1;

    teamStats[aId].awayScored += m.FTAG;
    teamStats[aId].awayConceded += m.FTHG;
    teamStats[aId].awayGames += 1;

    totalHomeGoals += m.FTHG;
    totalAwayGoals += m.FTAG;
    matchCount += 1;
  }

  const avgHomeGoals = matchCount > 0 ? totalHomeGoals / matchCount : 1.45;
  const avgAwayGoals = matchCount > 0 ? totalAwayGoals / matchCount : 1.15;
  const homeBoost = avgHomeGoals / (avgAwayGoals || 1.0);

  const teamParameters = {};
  const allTeams = Object.keys(teamStats);

  for (const teamId of allTeams) {
    const s = teamStats[teamId];
    const totalGames = s.homeGames + s.awayGames;
    if (totalGames === 0) {
      teamParameters[teamId] = { attack: 1.0, defense: 1.0 };
      continue;
    }

    const goalsScoredPerGame = (s.homeScored + s.awayScored) / totalGames;
    const goalsConcededPerGame = (s.homeConceded + s.awayConceded) / totalGames;
    const leagueAvgGoalsPerTeam = (avgHomeGoals + avgAwayGoals) / 2;

    teamParameters[teamId] = {
      attack: parseFloat((goalsScoredPerGame / (leagueAvgGoalsPerTeam || 1.3)).toFixed(3)),
      defense: parseFloat((goalsConcededPerGame / (leagueAvgGoalsPerTeam || 1.3)).toFixed(3)),
    };
  }

  return {
    teamParameters,
    leagueAvgHomeGoals: avgHomeGoals,
    leagueAvgAwayGoals: avgAwayGoals,
    homeBoost: parseFloat(homeBoost.toFixed(2))
  };
}

// Compute match probability distribution matrix (xG, score matrix, 1X2 probabilities)
export function predictMatchDixonColes(homeTeam, awayTeam, model, options = {}) {
  const homeId = getCanonicalTeamId(homeTeam);
  const awayId = getCanonicalTeamId(awayTeam);

  const homeParam = model?.teamParameters?.[homeId];
  const awayParam = model?.teamParameters?.[awayId];

  if (!homeParam || !awayParam) {
    return {
      status: 'UNAVAILABLE',
      reasonCode: 'MISSING_TEAM_DIXON_COLES_PARAMETERS',
      homeTeam,
      awayTeam,
      homeTeamId: homeId,
      awayTeamId: awayId,
      homeParamAvailable: !!homeParam,
      awayParamAvailable: !!awayParam
    };
  }

  const homeAdvantageBoost = options.homeAdvantageBoost !== undefined ? options.homeAdvantageBoost : 0.35;
  const eloDiff = options.eloDiff || 0;

  // Expected Goals (xG)
  let lambda = model.leagueAvgHomeGoals * homeParam.attack * awayParam.defense + homeAdvantageBoost + (eloDiff / 400);
  let mu = model.leagueAvgAwayGoals * awayParam.attack * homeParam.defense - (eloDiff / 600);

  lambda = Math.max(0.2, lambda);
  mu = Math.max(0.1, mu);

  const maxGoals = 6;
  const matrix = [];
  let homeWinProb = 0;
  let drawProb = 0;
  let awayWinProb = 0;

  let maxProb = -1;
  let mostLikelyScore = { home: 1, away: 0, prob: 0 };

  for (let i = 0; i <= maxGoals; i++) {
    const row = [];
    for (let j = 0; j <= maxGoals; j++) {
      const pBase = poissonProbability(i, lambda) * poissonProbability(j, mu);
      const tau = dixonColesTau(i, j, lambda, mu, -0.13);
      const prob = Math.max(0, pBase * tau);

      row.push(prob);

      if (i > j) homeWinProb += prob;
      else if (i === j) drawProb += prob;
      else awayWinProb += prob;

      if (prob > maxProb) {
        maxProb = prob;
        mostLikelyScore = { home: i, away: j, prob: prob };
      }
    }
    matrix.push(row);
  }

  // Normalize probabilities to sum to 100%
  const total = homeWinProb + drawProb + awayWinProb || 1.0;
  homeWinProb /= total;
  drawProb /= total;
  awayWinProb /= total;

  let over15Prob = 0;
  let over25Prob = 0;
  let over35Prob = 0;
  let bttsProb = 0;

  for (let i = 0; i <= maxGoals; i++) {
    for (let j = 0; j <= maxGoals; j++) {
      const p = matrix[i][j] / total;
      if (i + j > 1.5) over15Prob += p;
      if (i + j > 2.5) over25Prob += p;
      if (i + j > 3.5) over35Prob += p;
      if (i >= 1 && j >= 1) bttsProb += p;
    }
  }

  return {
    homeTeam,
    awayTeam,
    expectedGoalsHome: parseFloat(lambda.toFixed(2)),
    expectedGoalsAway: parseFloat(mu.toFixed(2)),
    homeWinProb: parseFloat(homeWinProb.toFixed(3)),
    drawProb: parseFloat(drawProb.toFixed(3)),
    awayWinProb: parseFloat(awayWinProb.toFixed(3)),
    overUnder: {
      over15: parseFloat(over15Prob.toFixed(3)),
      under15: parseFloat((1.0 - over15Prob).toFixed(3)),
      over25: parseFloat(over25Prob.toFixed(3)),
      under25: parseFloat((1.0 - over25Prob).toFixed(3)),
      over35: parseFloat(over35Prob.toFixed(3)),
      under35: parseFloat((1.0 - over35Prob).toFixed(3))
    },
    btts: {
      yes: parseFloat(bttsProb.toFixed(3)),
      no: parseFloat((1.0 - bttsProb).toFixed(3))
    },
    mostLikelyScore: {
      ...mostLikelyScore,
      prob: parseFloat((mostLikelyScore.prob / total).toFixed(3))
    },
    matrix
  };
}
