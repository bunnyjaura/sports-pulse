import { HistoricalDataService } from '../src/services/historicalDataService.js';
import { routeMatchPrediction } from '../src/utils/predictionRouter.js';
import { updateEloRatings, INITIAL_ELO } from '../src/utils/eloEngine.js';
import { predictMatchDixonColes } from '../src/utils/dixonColes.js';
import { getCanonicalTeamId } from '../src/utils/teamIdentity.js';
import { normalizeKickoffDate } from '../src/utils/dateNormalizer.js';

function predictCatBoostEloDiff(eloDiff) {
  const zHome = 0.22 + (0.0038 * eloDiff);
  const zDraw = -0.35 - (0.0005 * Math.abs(eloDiff));
  const zAway = -0.15 - (0.0036 * eloDiff);

  const expH = Math.exp(zHome);
  const expD = Math.exp(zDraw);
  const expA = Math.exp(zAway);
  const sum = expH + expD + expA;

  return { home: expH / sum, draw: expD / sum, away: expA / sum };
}

function calculateLogLoss(yTrue, pProbs) {
  const eps = 1e-15;
  const pHome = Math.max(eps, Math.min(1 - eps, pProbs.home));
  const pDraw = Math.max(eps, Math.min(1 - eps, pProbs.draw));
  const pAway = Math.max(eps, Math.min(1 - eps, pProbs.away));

  if (yTrue === 'H') return -Math.log(pHome);
  if (yTrue === 'D') return -Math.log(pDraw);
  if (yTrue === 'A') return -Math.log(pAway);
  return 0;
}

function calculateBrierScore(yTrue, pProbs) {
  const yH = yTrue === 'H' ? 1 : 0;
  const yD = yTrue === 'D' ? 1 : 0;
  const yA = yTrue === 'A' ? 1 : 0;

  return Math.pow(pProbs.home - yH, 2) + Math.pow(pProbs.draw - yD, 2) + Math.pow(pProbs.away - yA, 2);
}

function getPredictedClass(pProbs) {
  if (pProbs.home >= pProbs.draw && pProbs.home >= pProbs.away) return 'H';
  if (pProbs.draw >= pProbs.away) return 'D';
  return 'A';
}

function normalizeResultCode(ftr) {
  if (!ftr) return null;
  const str = String(ftr).toUpperCase().trim();
  if (str === 'H' || str === 'HOME' || str === '1') return 'H';
  if (str === 'D' || str === 'DRAW' || str === 'X') return 'D';
  if (str === 'A' || str === 'AWAY' || str === '2') return 'A';
  return null;
}

async function runFastWalkForwardBacktest() {
  console.log('========================================================================================');
  console.log(' ⚽ SPORTS PREDICTOR — TRUE CHRONOLOGICAL WALK-FORWARD BACKTEST ');
  console.log('========================================================================================\n');

  const { matches: rawMatches } = HistoricalDataService.loadDataset();
  console.log(`Total Dataset Loaded: ${rawMatches.length.toLocaleString()} matches`);

  const validMatches = rawMatches.filter(m => {
    const ftr = normalizeResultCode(m.FTR || m.ftr || (m.homeGoals > m.awayGoals ? 'H' : (m.awayGoals > m.homeGoals ? 'A' : 'D')));
    const normDate = normalizeKickoffDate(m.kickoffAt || m.date);
    return ftr !== null && normDate.isValid;
  }).sort((a, b) => {
    const aMs = normalizeKickoffDate(a.kickoffAt || a.date).timestampMs;
    const bMs = normalizeKickoffDate(b.kickoffAt || b.date).timestampMs;
    return aMs - bMs;
  });

  console.log(`Valid Chronological Matches: ${validMatches.length.toLocaleString()}\n`);

  const BURN_IN = 1000;
  const evalMatches = validMatches.slice(BURN_IN);
  console.log(`Evaluation Set Size (Post Burn-In Window): ${evalMatches.length.toLocaleString()} matches\n`);

  // Incremental Pre-Match State Data Structures (Strictly t < T)
  const eloDb = {};
  const teamStats = {};
  let totalHomeGoals = 0;
  let totalAwayGoals = 0;
  let totalMatchCount = 0;

  const teamHistoryCounts = {};
  const teamRecentLogs = {};

  let cumulativeH = 0;
  let cumulativeD = 0;
  let cumulativeA = 0;

  // Build State for Burn-In Matches (t < T_0)
  for (let i = 0; i < BURN_IN; i++) {
    const m = validMatches[i];
    const hId = getCanonicalTeamId(m.homeTeam);
    const aId = getCanonicalTeamId(m.awayTeam);
    const ftr = normalizeResultCode(m.FTR || m.ftr || (m.homeGoals > m.awayGoals ? 'H' : (m.awayGoals > m.homeGoals ? 'A' : 'D')));
    const hg = m.FTHG !== undefined ? m.FTHG : m.homeGoals;
    const ag = m.FTAG !== undefined ? m.FTAG : m.awayGoals;

    if (!hId || !aId || ftr === null || isNaN(hg) || isNaN(ag)) continue;

    // Cumulative Tally
    if (ftr === 'H') cumulativeH++;
    else if (ftr === 'D') cumulativeD++;
    else if (ftr === 'A') cumulativeA++;

    // Incremental Elo Update
    if (!eloDb[hId]) eloDb[hId] = INITIAL_ELO;
    if (!eloDb[aId]) eloDb[aId] = INITIAL_ELO;
    const eloRes = updateEloRatings(eloDb[hId], eloDb[aId], hg, ag);
    eloDb[hId] = eloRes.newHomeElo;
    eloDb[aId] = eloRes.newAwayElo;

    // Incremental Dixon-Coles Stats Update
    if (!teamStats[hId]) teamStats[hId] = { homeScored: 0, homeConceded: 0, homeGames: 0, awayScored: 0, awayConceded: 0, awayGames: 0 };
    if (!teamStats[aId]) teamStats[aId] = { homeScored: 0, homeConceded: 0, homeGames: 0, awayScored: 0, awayConceded: 0, awayGames: 0 };

    teamStats[hId].homeScored += hg;
    teamStats[hId].homeConceded += ag;
    teamStats[hId].homeGames += 1;

    teamStats[aId].awayScored += ag;
    teamStats[aId].awayConceded += hg;
    teamStats[aId].awayGames += 1;

    totalHomeGoals += hg;
    totalAwayGoals += ag;
    totalMatchCount += 1;

    // Team Counts
    teamHistoryCounts[hId] = (teamHistoryCounts[hId] || 0) + 1;
    teamHistoryCounts[aId] = (teamHistoryCounts[aId] || 0) + 1;

    if (!teamRecentLogs[hId]) teamRecentLogs[hId] = [];
    if (!teamRecentLogs[aId]) teamRecentLogs[aId] = [];
    teamRecentLogs[hId].push({ ftr, isHome: true, hg, ag });
    teamRecentLogs[aId].push({ ftr, isHome: false, hg, ag });
  }

  // Model Evaluation Tracking
  const models = {
    ensemble: { name: 'Current Production Pipeline (Ensemble/Router)', logLoss: 0, brier: 0, correct: 0, count: 0, hCorrect: 0, hCount: 0, dCorrect: 0, dCount: 0, aCorrect: 0, aCount: 0 },
    eloOnly: { name: 'Elo-Only Model', logLoss: 0, brier: 0, correct: 0, count: 0, hCorrect: 0, hCount: 0, dCorrect: 0, dCount: 0, aCorrect: 0, aCount: 0 },
    dixonColesOnly: { name: 'Dixon-Coles-Only Model', logLoss: 0, brier: 0, correct: 0, count: 0, hCorrect: 0, hCount: 0, dCorrect: 0, dCount: 0, aCorrect: 0, aCount: 0 },
    homeAdvantage: { name: 'Home-Advantage Constant Baseline', logLoss: 0, brier: 0, correct: 0, count: 0, hCorrect: 0, hCount: 0, dCorrect: 0, dCount: 0, aCorrect: 0, aCount: 0 },
    naiveMajority: { name: 'Naive Majority Predictor', logLoss: 0, brier: 0, correct: 0, count: 0, hCorrect: 0, hCount: 0, dCorrect: 0, dCount: 0, aCorrect: 0, aCount: 0 }
  };

  const modeStats = {
    FULL_HISTORY: { count: 0, correct: 0, logLoss: 0, brier: 0 },
    COLD_START: { count: 0, correct: 0, logLoss: 0, brier: 0 },
    STRENGTH_PRIOR: { count: 0, correct: 0, logLoss: 0, brier: 0 }
  };

  const thresholds = [0.50, 0.60, 0.70, 0.80, 0.90];
  const thresholdStats = {};
  for (const t of thresholds) thresholdStats[t] = { count: 0, correct: 0, sumProb: 0 };

  const buckets = [
    { min: 0.30, max: 0.40, count: 0, correct: 0, sumProb: 0 },
    { min: 0.40, max: 0.50, count: 0, correct: 0, sumProb: 0 },
    { min: 0.50, max: 0.60, count: 0, correct: 0, sumProb: 0 },
    { min: 0.60, max: 0.70, count: 0, correct: 0, sumProb: 0 },
    { min: 0.70, max: 0.80, count: 0, correct: 0, sumProb: 0 },
    { min: 0.80, max: 0.90, count: 0, correct: 0, sumProb: 0 },
    { min: 0.90, max: 1.00, count: 0, correct: 0, sumProb: 0 }
  ];

  let evalCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < evalMatches.length; i++) {
    const targetMatch = evalMatches[i];
    const actualResult = normalizeResultCode(targetMatch.FTR || targetMatch.ftr || (targetMatch.homeGoals > targetMatch.awayGoals ? 'H' : (targetMatch.awayGoals > targetMatch.homeGoals ? 'A' : 'D')));
    const hg = targetMatch.FTHG !== undefined ? targetMatch.FTHG : targetMatch.homeGoals;
    const ag = targetMatch.FTAG !== undefined ? targetMatch.FTAG : targetMatch.awayGoals;

    if (!actualResult || isNaN(hg) || isNaN(ag)) continue;

    const hId = getCanonicalTeamId(targetMatch.homeTeam);
    const aId = getCanonicalTeamId(targetMatch.awayTeam);
    if (!hId || !aId) continue;

    const cutoffIso = normalizeKickoffDate(targetMatch.kickoffAt || targetMatch.date).isoString;

    // --- STEP A: EVALUATE ALL MODELS AT TIME T IMMEDIATELY BEFORE KICKOFF ---
    const hCount = teamHistoryCounts[hId] || 0;
    const aCount = teamHistoryCounts[aId] || 0;

    // 1. Elo-Only Model
    const hElo = eloDb[hId] || INITIAL_ELO;
    const aElo = eloDb[aId] || INITIAL_ELO;
    const eloDiff = hElo - aElo;
    const pElo = predictCatBoostEloDiff(eloDiff);
    const predClassElo = getPredictedClass(pElo);

    // 2. Dixon-Coles Model (Computed from incremental pre-kickoff stats)
    const avgHomeGoals = totalMatchCount > 0 ? totalHomeGoals / totalMatchCount : 1.45;
    const avgAwayGoals = totalMatchCount > 0 ? totalAwayGoals / totalMatchCount : 1.15;
    const homeBoost = avgHomeGoals / (avgAwayGoals || 1.0);
    const leagueAvgGoalsPerTeam = (avgHomeGoals + avgAwayGoals) / 2;

    const buildDcParam = (tId) => {
      const s = teamStats[tId];
      if (!s || (s.homeGames + s.awayGames) === 0) return { attack: 1.0, defense: 1.0 };
      const gScored = (s.homeScored + s.awayScored) / (s.homeGames + s.awayGames);
      const gConceded = (s.homeConceded + s.awayConceded) / (s.homeGames + s.awayGames);
      return {
        attack: parseFloat((gScored / (leagueAvgGoalsPerTeam || 1.3)).toFixed(3)),
        defense: parseFloat((gConceded / (leagueAvgGoalsPerTeam || 1.3)).toFixed(3))
      };
    };

    const dcModelCurrent = {
      teamParameters: { [hId]: buildDcParam(hId), [aId]: buildDcParam(aId) },
      leagueAvgHomeGoals: avgHomeGoals,
      leagueAvgAwayGoals: avgAwayGoals,
      homeBoost: parseFloat(homeBoost.toFixed(2))
    };

    const dcPred = predictMatchDixonColes(targetMatch.homeTeam, targetMatch.awayTeam, dcModelCurrent, { eloDiff });
    const pDc = dcPred.status !== 'UNAVAILABLE' ? { home: dcPred.homeWinProb, draw: dcPred.drawProb, away: dcPred.awayWinProb } : pElo;
    const predClassDc = getPredictedClass(pDc);

    // 3. Current Production Ensemble Pipeline
    let pEnsemble = null;
    let modeKey = 'FULL_HISTORY';

    if (hCount >= 50 && aCount >= 50) {
      modeKey = 'FULL_HISTORY';
      const pH = 0.50 * pElo.home + 0.50 * pDc.home;
      const pD = 0.50 * pElo.draw + 0.50 * pDc.draw;
      const pA = 0.50 * pElo.away + 0.50 * pDc.away;
      const sumP = pH + pD + pA;
      pEnsemble = { home: pH / sumP, draw: pD / sumP, away: pA / sumP };
    } else if (hCount >= 1 && aCount >= 1) {
      modeKey = 'COLD_START';
      // Multi-factor cold-start surrogate
      const recentA = teamRecentLogs[hId]?.slice(-5) || [];
      const recentB = teamRecentLogs[aId]?.slice(-5) || [];
      const ppgA = recentA.length > 0 ? recentA.reduce((acc, m) => acc + (m.ftr === 'H' ? 3 : (m.ftr === 'D' ? 1 : 0)), 0) / recentA.length : 1.3;
      const ppgB = recentB.length > 0 ? recentB.reduce((acc, m) => acc + (m.ftr === 'A' ? 3 : (m.ftr === 'D' ? 1 : 0)), 0) / recentB.length : 1.3;
      const formDiff = (ppgA - ppgB) * 50;

      const effEloDiff = eloDiff + formDiff;
      pEnsemble = predictCatBoostEloDiff(effEloDiff);
    } else {
      modeKey = 'STRENGTH_PRIOR';
      pEnsemble = predictCatBoostEloDiff(65); // Home advantage prior
    }

    const predClassEnsemble = getPredictedClass(pEnsemble);

    // 4. Home-Advantage Baseline (0.45 / 0.27 / 0.28)
    const pHomeAdv = { home: 0.45, draw: 0.27, away: 0.28 };
    const predClassHomeAdv = 'H';

    // 5. Naive Majority Predictor (Cumulative Class Frequencies)
    const totalCum = cumulativeH + cumulativeD + cumulativeA;
    const pNaive = totalCum > 0 ? { home: cumulativeH / totalCum, draw: cumulativeD / totalCum, away: cumulativeA / totalCum } : pHomeAdv;
    const predClassNaive = getPredictedClass(pNaive);

    // --- ACCUMULATE EVALUATION METRICS ---
    evalCount++;

    // Ensemble
    const llEns = calculateLogLoss(actualResult, pEnsemble);
    const bsEns = calculateBrierScore(actualResult, pEnsemble);
    models.ensemble.logLoss += llEns;
    models.ensemble.brier += bsEns;
    models.ensemble.count++;
    if (predClassEnsemble === actualResult) models.ensemble.correct++;
    if (actualResult === 'H') { models.ensemble.hCount++; if (predClassEnsemble === 'H') models.ensemble.hCorrect++; }
    else if (actualResult === 'D') { models.ensemble.dCount++; if (predClassEnsemble === 'D') models.ensemble.dCorrect++; }
    else if (actualResult === 'A') { models.ensemble.aCount++; if (predClassEnsemble === 'A') models.ensemble.aCorrect++; }

    // Elo Only
    models.eloOnly.logLoss += calculateLogLoss(actualResult, pElo);
    models.eloOnly.brier += calculateBrierScore(actualResult, pElo);
    models.eloOnly.count++;
    if (predClassElo === actualResult) models.eloOnly.correct++;
    if (actualResult === 'H') { models.eloOnly.hCount++; if (predClassElo === 'H') models.eloOnly.hCorrect++; }
    else if (actualResult === 'D') { models.eloOnly.dCount++; if (predClassElo === 'D') models.eloOnly.dCorrect++; }
    else if (actualResult === 'A') { models.eloOnly.aCount++; if (predClassElo === 'A') models.eloOnly.aCorrect++; }

    // Dixon Coles Only
    models.dixonColesOnly.logLoss += calculateLogLoss(actualResult, pDc);
    models.dixonColesOnly.brier += calculateBrierScore(actualResult, pDc);
    models.dixonColesOnly.count++;
    if (predClassDc === actualResult) models.dixonColesOnly.correct++;
    if (actualResult === 'H') { models.dixonColesOnly.hCount++; if (predClassDc === 'H') models.dixonColesOnly.hCorrect++; }
    else if (actualResult === 'D') { models.dixonColesOnly.dCount++; if (predClassDc === 'D') models.dixonColesOnly.dCorrect++; }
    else if (actualResult === 'A') { models.dixonColesOnly.aCount++; if (predClassDc === 'A') models.dixonColesOnly.aCorrect++; }

    // Home Advantage Baseline
    models.homeAdvantage.logLoss += calculateLogLoss(actualResult, pHomeAdv);
    models.homeAdvantage.brier += calculateBrierScore(actualResult, pHomeAdv);
    models.homeAdvantage.count++;
    if (predClassHomeAdv === actualResult) models.homeAdvantage.correct++;
    if (actualResult === 'H') { models.homeAdvantage.hCount++; if (predClassHomeAdv === 'H') models.homeAdvantage.hCorrect++; }
    else if (actualResult === 'D') { models.homeAdvantage.dCount++; if (predClassHomeAdv === 'D') models.homeAdvantage.dCorrect++; }
    else if (actualResult === 'A') { models.homeAdvantage.aCount++; if (predClassHomeAdv === 'A') models.homeAdvantage.aCorrect++; }

    // Naive Majority Predictor
    models.naiveMajority.logLoss += calculateLogLoss(actualResult, pNaive);
    models.naiveMajority.brier += calculateBrierScore(actualResult, pNaive);
    models.naiveMajority.count++;
    if (predClassNaive === actualResult) models.naiveMajority.correct++;
    if (actualResult === 'H') { models.naiveMajority.hCount++; if (predClassNaive === 'H') models.naiveMajority.hCorrect++; }
    else if (actualResult === 'D') { models.naiveMajority.dCount++; if (predClassNaive === 'D') models.naiveMajority.dCorrect++; }
    else if (actualResult === 'A') { models.naiveMajority.aCount++; if (predClassNaive === 'A') models.naiveMajority.aCorrect++; }

    // Mode Stats
    if (modeStats[modeKey]) {
      modeStats[modeKey].count++;
      modeStats[modeKey].logLoss += llEns;
      modeStats[modeKey].brier += bsEns;
      if (predClassEnsemble === actualResult) modeStats[modeKey].correct++;
    }

    // Threshold Stats
    const maxProb = Math.max(pEnsemble.home, pEnsemble.draw, pEnsemble.away);
    for (const t of thresholds) {
      if (maxProb >= t) {
        thresholdStats[t].count++;
        thresholdStats[t].sumProb += maxProb;
        if (predClassEnsemble === actualResult) thresholdStats[t].correct++;
      }
    }

    // Calibration Buckets
    for (const b of buckets) {
      if (maxProb >= b.min && maxProb < b.max) {
        b.count++;
        b.sumProb += maxProb;
        if (predClassEnsemble === actualResult) b.correct++;
        break;
      }
    }

    // --- STEP B: ADVANCE STATE POST-KICKOFF (t >= T) AFTER EVALUATION ---
    if (actualResult === 'H') cumulativeH++;
    else if (actualResult === 'D') cumulativeD++;
    else if (actualResult === 'A') cumulativeA++;

    if (!eloDb[hId]) eloDb[hId] = INITIAL_ELO;
    if (!eloDb[aId]) eloDb[aId] = INITIAL_ELO;
    const eloPost = updateEloRatings(eloDb[hId], eloDb[aId], hg, ag);
    eloDb[hId] = eloPost.newHomeElo;
    eloDb[aId] = eloPost.newAwayElo;

    if (!teamStats[hId]) teamStats[hId] = { homeScored: 0, homeConceded: 0, homeGames: 0, awayScored: 0, awayConceded: 0, awayGames: 0 };
    if (!teamStats[aId]) teamStats[aId] = { homeScored: 0, homeConceded: 0, homeGames: 0, awayScored: 0, awayConceded: 0, awayGames: 0 };

    teamStats[hId].homeScored += hg;
    teamStats[hId].homeConceded += ag;
    teamStats[hId].homeGames += 1;

    teamStats[aId].awayScored += ag;
    teamStats[aId].awayConceded += hg;
    teamStats[aId].awayGames += 1;

    totalHomeGoals += hg;
    totalAwayGoals += ag;
    totalMatchCount += 1;

    teamHistoryCounts[hId] = (teamHistoryCounts[hId] || 0) + 1;
    teamHistoryCounts[aId] = (teamHistoryCounts[aId] || 0) + 1;

    if (!teamRecentLogs[hId]) teamRecentLogs[hId] = [];
    if (!teamRecentLogs[aId]) teamRecentLogs[aId] = [];
    teamRecentLogs[hId].push({ ftr: actualResult, isHome: true, hg, ag });
    teamRecentLogs[aId].push({ ftr: actualResult, isHome: false, hg, ag });

    if (evalCount % 20000 === 0) {
      console.log(`  Progress: ${evalCount.toLocaleString()} / ${evalMatches.length.toLocaleString()} matches evaluated...`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n========================================================================================`);
  console.log(` ✅ WALK-FORWARD BACKTEST COMPLETED IN ${elapsed}s ACROSS ${evalCount.toLocaleString()} FIXTURES `);
  console.log(`========================================================================================\n`);

  // Model Leaderboard Summary Table
  const modelList = Object.values(models).map(m => {
    const avgLogLoss = m.count > 0 ? (m.logLoss / m.count).toFixed(4) : 'N/A';
    const avgBrier = m.count > 0 ? (m.brier / m.count).toFixed(4) : 'N/A';
    const acc = m.count > 0 ? ((m.correct / m.count) * 100).toFixed(2) + '%' : 'N/A';
    const hAcc = m.hCount > 0 ? ((m.hCorrect / m.hCount) * 100).toFixed(1) + '%' : 'N/A';
    const dAcc = m.dCount > 0 ? ((m.dCorrect / m.dCount) * 100).toFixed(1) + '%' : 'N/A';
    const aAcc = m.aCount > 0 ? ((m.aCorrect / m.aCount) * 100).toFixed(1) + '%' : 'N/A';
    return {
      name: m.name,
      logLoss: parseFloat(avgLogLoss),
      brier: parseFloat(avgBrier),
      accuracy: acc,
      hAcc,
      dAcc,
      aAcc,
      count: m.count
    };
  }).sort((a, b) => a.logLoss - b.logLoss);

  console.log('========================================================================================');
  console.log(' 🏆 MODEL COMPARISON LEADERBOARD (SORTED BY LOG LOSS LOWEST TO HIGHEST) ');
  console.log('========================================================================================\n');

  console.log('| Rank | Model Name | Log Loss | Brier Score | Overall Accuracy | Home Acc | Draw Acc | Away Acc | Evaluation Samples |');
  console.log('| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |');

  modelList.forEach((m, idx) => {
    console.log(`| **#${idx + 1}** | **${m.name}** | **${m.logLoss.toFixed(4)}** | **${m.brier.toFixed(4)}** | **${m.accuracy}** | ${m.hAcc} | ${m.dAcc} | ${m.aAcc} | ${m.count.toLocaleString()} |`);
  });

  console.log('\n========================================================================================');
  console.log(' 📊 PERFORMANCE BREAKDOWN BY PREDICTION MODE ');
  console.log('========================================================================================\n');

  console.log('| Prediction Mode | Sample Size | Accuracy | Log Loss | Brier Score | Description |');
  console.log('| :--- | :---: | :---: | :---: | :---: | :--- |');

  for (const [mode, s] of Object.entries(modeStats)) {
    if (s.count === 0) continue;
    const acc = ((s.correct / s.count) * 100).toFixed(2) + '%';
    const ll = (s.logLoss / s.count).toFixed(4);
    const bs = (s.brier / s.count).toFixed(4);
    const desc = mode === 'FULL_HISTORY' ? 'Both teams N >= 50 (50/50 CatBoost + Dixon-Coles Ensemble)' : (mode === 'COLD_START' ? '1 <= Min(Home, Away) < 50 (Multi-Factor Cold Start Pipeline)' : 'Both teams N = 0 (League Strength + Static Priors)');
    console.log(`| **\`${mode}\`** | ${s.count.toLocaleString()} | **${acc}** | **${ll}** | **${bs}** | ${desc} |`);
  }

  console.log('\n========================================================================================');
  console.log(' 🎯 ACCURACY & WIN RATE BY CONFIDENCE THRESHOLDS ');
  console.log('========================================================================================\n');

  console.log('| Confidence Threshold | Sample Size | % of Total Fixtures | Predicted Outcome Win Rate | Avg Probability | Calibration Gap |');
  console.log('| :--- | :---: | :---: | :---: | :---: | :---: |');

  for (const t of thresholds) {
    const s = thresholdStats[t];
    if (s.count === 0) continue;
    const pctTotal = ((s.count / evalCount) * 100).toFixed(1) + '%';
    const winRate = ((s.correct / s.count) * 100).toFixed(2) + '%';
    const avgP = ((s.sumProb / s.count) * 100).toFixed(1) + '%';
    const gap = (Math.abs((s.sumProb / s.count) - (s.correct / s.count)) * 100).toFixed(1) + '%';
    console.log(`| **>= ${(t * 100).toFixed(0)}%** | ${s.count.toLocaleString()} | ${pctTotal} | **${winRate}** | ${avgP} | ${gap} |`);
  }

  console.log('\n========================================================================================');
  console.log(' 📐 PROBABILITY BUCKET CALIBRATION (EXPECTED CALIBRATION ERROR) ');
  console.log('========================================================================================\n');

  console.log('| Probability Bucket | Sample Count | Expected Win Rate (Conf) | Actual Win Rate (Acc) | Calibration Error |');
  console.log('| :--- | :---: | :---: | :---: | :---: |');

  let totalEceSum = 0;
  for (const b of buckets) {
    if (b.count === 0) continue;
    const avgConf = b.sumProb / b.count;
    const actualAcc = b.correct / b.count;
    const err = Math.abs(avgConf - actualAcc);
    totalEceSum += (b.count / evalCount) * err;
    console.log(`| **${(b.min * 100).toFixed(0)}% – ${(b.max * 100).toFixed(0)}%** | ${b.count.toLocaleString()} | ${(avgConf * 100).toFixed(1)}% | ${(actualAcc * 100).toFixed(1)}% | ${(err * 100).toFixed(2)}% |`);
  }

  console.log(`\nOverall Expected Calibration Error (ECE): **${(totalEceSum * 100).toFixed(2)}%**`);
  console.log('========================================================================================\n');
}

runFastWalkForwardBacktest().catch(err => {
  console.error('Walk-forward backtest failed:', err);
  process.exit(1);
});
