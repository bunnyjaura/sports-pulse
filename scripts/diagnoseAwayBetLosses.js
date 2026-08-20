import { HistoricalDataService } from '../src/services/historicalDataService.js';
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

function applyTemperatureScaling(pProbs, temp = 1.25) {
  const logH = Math.log(Math.max(1e-15, pProbs.home)) / temp;
  const logD = Math.log(Math.max(1e-15, pProbs.draw)) / temp;
  const logA = Math.log(Math.max(1e-15, pProbs.away)) / temp;

  const maxLog = Math.max(logH, logD, logA);
  const expH = Math.exp(logH - maxLog);
  const expD = Math.exp(logD - maxLog);
  const expA = Math.exp(logA - maxLog);
  const sum = expH + expD + expA;

  return { home: expH / sum, draw: expD / sum, away: expA / sum };
}

function normalizeResultCode(ftr) {
  if (!ftr) return null;
  const str = String(ftr).toUpperCase().trim();
  if (str === 'H' || str === 'HOME' || str === '1') return 'H';
  if (str === 'D' || str === 'DRAW' || str === 'X') return 'D';
  if (str === 'A' || str === 'AWAY' || str === '2') return 'A';
  return null;
}

function extractBookmakerOdds(m) {
  const oH = Number(m.B365H || m.b365H || m.PSH || m.psH || m.B365_H || 0);
  const oD = Number(m.B365D || m.b365D || m.PSD || m.psD || m.B365_D || 0);
  const oA = Number(m.B365A || m.b365A || m.PSA || m.psA || m.B365_A || 0);

  if (oH > 1.01 && oD > 1.01 && oA > 1.01) {
    const rawH = 1 / oH;
    const rawD = 1 / oD;
    const rawA = 1 / oA;
    const margin = rawH + rawD + rawA;
    return {
      isValid: true,
      odds: { H: oH, D: oD, A: oA },
      rawProb: { H: rawH, D: rawD, A: rawA },
      normProb: { H: rawH / margin, D: rawD / margin, A: rawA / margin },
      margin
    };
  }
  return { isValid: false };
}

function calculateBinMetrics(bets) {
  if (!bets || bets.length === 0) {
    return { count: 0, avgModelP: 'N/A', winRate: 'N/A', avgBookP: 'N/A', avgEdge: 'N/A', profit: 'N/A', roi: 'N/A', logLoss: 'N/A', brier: 'N/A' };
  }

  const N = bets.length;
  let wins = 0;
  let totalProfit = 0;
  let sumModelP = 0;
  let sumBookP = 0;
  let sumEdge = 0;
  let sumLogLoss = 0;
  let sumBrier = 0;

  for (const b of bets) {
    const y = b.actual === 'A' ? 1 : 0;
    if (y === 1) wins++;
    const pnl = y === 1 ? (b.odds - 1.0) : -1.0;
    totalProfit += pnl;

    sumModelP += b.pModel;
    sumBookP += b.pBookNorm;
    sumEdge += (b.pModel - b.pBookNorm);

    const eps = 1e-15;
    const pClamped = Math.max(eps, Math.min(1 - eps, b.pModel));
    const ll = y === 1 ? -Math.log(pClamped) : -Math.log(1 - pClamped);
    const bs = Math.pow(b.pModel - y, 2);

    sumLogLoss += ll;
    sumBrier += bs;
  }

  const avgModelP = (sumModelP / N);
  const winRate = (wins / N);
  const avgBookP = (sumBookP / N);
  const avgEdge = (sumEdge / N);
  const roi = (totalProfit / N);
  const avgLogLoss = (sumLogLoss / N);
  const avgBrier = (sumBrier / N);

  return {
    count: N,
    avgModelP: (avgModelP * 100).toFixed(1) + '%',
    winRate: (winRate * 100).toFixed(1) + '%',
    avgBookP: (avgBookP * 100).toFixed(1) + '%',
    avgEdge: (avgEdge * 100).toFixed(1) + '%',
    profit: (totalProfit >= 0 ? '+' : '') + totalProfit.toFixed(2) + 'u',
    roi: (roi * 100).toFixed(2) + '%',
    logLoss: avgLogLoss.toFixed(4),
    brier: avgBrier.toFixed(4),
    rawRoi: roi,
    overconfidenceGap: ((avgModelP - winRate) * 100).toFixed(1) + '%'
  };
}

async function runAwayDiagnostic() {
  console.log('========================================================================================');
  console.log(' 🔍 DEDICATED DIAGNOSTIC INVESTIGATION: AWAY BET PERFORMANCE & OVERCONFIDENCE ');
  console.log('========================================================================================\n');

  console.log('--- MATHEMATICAL FORMULAS USED IN BACKTEST ENGINE ---');
  console.log('1. Raw Bookmaker Implied Probabilities: pi_H = 1/O_H, pi_D = 1/O_D, pi_A = 1/O_A');
  console.log('2. Bookmaker Overround / Margin: M = pi_H + pi_D + pi_A  (M >= 1.0)');
  console.log('3. Fair Normalized Bookmaker Probabilities: p_book,k = pi_k / M');
  console.log('4. Model Expected Value (EV): EV_A = (p_model,A * O_A) - 1.0');
  console.log('5. Model Edge (vs Fair Bookmaker Prob): Edge_A = p_model,A - p_book,A\n');

  const { matches: rawMatches } = HistoricalDataService.loadDataset();
  const validMatches = rawMatches.filter(m => {
    const ftr = normalizeResultCode(m.FTR || m.ftr || (m.homeGoals > m.awayGoals ? 'H' : (m.awayGoals > m.homeGoals ? 'A' : 'D')));
    const normDate = normalizeKickoffDate(m.kickoffAt || m.date);
    return ftr !== null && normDate.isValid;
  }).sort((a, b) => normalizeKickoffDate(a.kickoffAt || a.date).timestampMs - normalizeKickoffDate(b.kickoffAt || b.date).timestampMs);

  const BURN_IN = 1000;
  const eloDb = {};
  const teamStats = {};
  let totalHomeGoals = 0;
  let totalAwayGoals = 0;
  let totalMatchCount = 0;
  const teamHistoryCounts = {};

  // Burn-in phase
  for (let i = 0; i < BURN_IN; i++) {
    const m = validMatches[i];
    const hId = getCanonicalTeamId(m.homeTeam);
    const aId = getCanonicalTeamId(m.awayTeam);
    const hg = m.FTHG !== undefined ? m.FTHG : m.homeGoals;
    const ag = m.FTAG !== undefined ? m.FTAG : m.awayGoals;

    if (!hId || !aId || isNaN(hg) || isNaN(ag)) continue;

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
  }

  const evalMatches = validMatches.slice(BURN_IN);
  const awayBets = []; // All Away bets where EV > 3%

  for (let i = 0; i < evalMatches.length; i++) {
    const targetMatch = evalMatches[i];
    const actualResult = normalizeResultCode(targetMatch.FTR || targetMatch.ftr || (targetMatch.homeGoals > targetMatch.awayGoals ? 'H' : (targetMatch.awayGoals > targetMatch.homeGoals ? 'A' : 'D')));
    const hg = targetMatch.FTHG !== undefined ? targetMatch.FTHG : targetMatch.homeGoals;
    const ag = targetMatch.FTAG !== undefined ? targetMatch.FTAG : targetMatch.awayGoals;

    if (!actualResult || isNaN(hg) || isNaN(ag)) continue;

    const hId = getCanonicalTeamId(targetMatch.homeTeam);
    const aId = getCanonicalTeamId(targetMatch.awayTeam);
    if (!hId || !aId) continue;

    const bookOdds = extractBookmakerOdds(targetMatch);

    if (bookOdds.isValid) {
      const hElo = eloDb[hId] || INITIAL_ELO;
      const aElo = eloDb[aId] || INITIAL_ELO;
      const eloDiff = hElo - aElo;
      const pElo = predictCatBoostEloDiff(eloDiff);

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

      const pRaw8020 = {
        home: 0.80 * pElo.home + 0.20 * pDc.home,
        draw: 0.80 * pElo.draw + 0.20 * pDc.draw,
        away: 0.80 * pElo.away + 0.20 * pDc.away
      };
      const sumRaw = pRaw8020.home + pRaw8020.draw + pRaw8020.away;
      pRaw8020.home /= sumRaw; pRaw8020.draw /= sumRaw; pRaw8020.away /= sumRaw;

      const pCalibrated = applyTemperatureScaling(pRaw8020, 1.25);

      const oA = bookOdds.odds.A;
      const pModelA = pCalibrated.away;
      const pBookRawA = bookOdds.rawProb.A;
      const pBookNormA = bookOdds.normProb.A;

      const evA = (pModelA * oA) - 1.0;
      const edgeA = pModelA - pBookNormA;

      const hCount = teamHistoryCounts[hId] || 0;
      const aCount = teamHistoryCounts[aId] || 0;
      const sampleSize = Math.min(hCount, aCount);
      const mode = (hCount >= 50 && aCount >= 50) ? 'FULL_HISTORY' : 'COLD_START';

      if (evA > 0.03) {
        awayBets.push({
          matchIndex: i,
          homeTeam: targetMatch.homeTeam,
          awayTeam: targetMatch.awayTeam,
          league: targetMatch.leagueId || 'ENG_PL',
          year: (targetMatch.kickoffAt || targetMatch.date || '2024').substring(0, 4),
          actual: actualResult,
          odds: oA,
          pModel: pModelA,
          pBookRaw: pBookRawA,
          pBookNorm: pBookNormA,
          ev: evA,
          edge: edgeA,
          hElo,
          aElo,
          eloDiff,
          sampleSize,
          mode
        });
      }
    }

    // Advance State Post-Kickoff
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
  }

  console.log(`Total Away Selections Evaluated at EV > 3%: ${awayBets.length.toLocaleString()} bets\n`);

  // --- BREAKDOWN 1: BY BOOKMAKER AWAY ODDS BUCKETS ---
  console.log('========================================================================================');
  console.log(' 📌 BREAKDOWN 1: AWAY BETS BY BOOKMAKER ODDS BUCKET ');
  console.log('========================================================================================\n');

  const oddsBuckets = [
    { label: '1.0 – 1.5 (Heavy Fav)', min: 1.0, max: 1.5 },
    { label: '1.5 – 2.0 (Fav)', min: 1.5, max: 2.0 },
    { label: '2.0 – 2.5 (Slight Fav)', min: 2.0, max: 2.5 },
    { label: '2.5 – 3.0 (Even)', min: 2.5, max: 3.0 },
    { label: '3.0 – 4.0 (Underdog)', min: 3.0, max: 4.0 },
    { label: '4.0 – 5.0 (Moderate Underdog)', min: 4.0, max: 5.0 },
    { label: '5.0 – 7.5 (Long Underdog)', min: 5.0, max: 7.5 },
    { label: '7.5+ (Extreme Underdog)', min: 7.5, max: 999 }
  ];

  console.log('| Odds Bucket | Bets | Avg Model P | Actual Win Rate | Overconfidence Gap | Avg Book P (Norm) | Avg Edge | Total Profit | ROI / Yield | Log Loss | Brier Score |');
  console.log('| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |');

  oddsBuckets.forEach(b => {
    const sub = awayBets.filter(rec => rec.odds >= b.min && rec.odds < b.max);
    const m = calculateBinMetrics(sub);
    if (m.count > 0) {
      console.log(`| **${b.label}** | ${m.count.toLocaleString()} | ${m.avgModelP} | **${m.winRate}** | **${m.overconfidenceGap}** | ${m.avgBookP} | ${m.avgEdge} | ${m.profit} | **${m.roi}** | ${m.logLoss} | ${m.brier} |`);
    }
  });

  // --- BREAKDOWN 2: BY MODEL PROBABILITY BUCKETS ---
  console.log('\n========================================================================================');
  console.log(' 📌 BREAKDOWN 2: AWAY BETS BY MODEL PROBABILITY BUCKET ');
  console.log('========================================================================================\n');

  const probBuckets = [
    { label: '0% – 20%', min: 0.0, max: 0.20 },
    { label: '20% – 30%', min: 0.20, max: 0.30 },
    { label: '30% – 40%', min: 0.30, max: 0.40 },
    { label: '40% – 50%', min: 0.40, max: 0.50 },
    { label: '50% – 60%', min: 0.50, max: 0.60 },
    { label: '60%+', min: 0.60, max: 1.00 }
  ];

  console.log('| Model Prob Bucket | Bets | Avg Model P | Actual Win Rate | Overconfidence Gap | Avg Book P | Avg Edge | Total Profit | ROI / Yield | Log Loss | Brier Score |');
  console.log('| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |');

  probBuckets.forEach(b => {
    const sub = awayBets.filter(rec => rec.pModel >= b.min && rec.pModel < b.max);
    const m = calculateBinMetrics(sub);
    if (m.count > 0) {
      console.log(`| **${b.label}** | ${m.count.toLocaleString()} | ${m.avgModelP} | **${m.winRate}** | **${m.overconfidenceGap}** | ${m.avgBookP} | ${m.avgEdge} | ${m.profit} | **${m.roi}** | ${m.logLoss} | ${m.brier} |`);
    }
  });

  // --- BREAKDOWN 3: BY MODEL EDGE BUCKETS ---
  console.log('\n========================================================================================');
  console.log(' 📌 BREAKDOWN 3: AWAY BETS BY MODEL EDGE BUCKET (p_model - p_book) ');
  console.log('========================================================================================\n');

  const edgeBuckets = [
    { label: '3% – 5% Edge', min: 0.03, max: 0.05 },
    { label: '5% – 10% Edge', min: 0.05, max: 0.10 },
    { label: '10% – 15% Edge', min: 0.10, max: 0.15 },
    { label: '15% – 20% Edge', min: 0.15, max: 0.20 },
    { label: '20%+ Edge', min: 0.20, max: 1.00 }
  ];

  console.log('| Edge Bucket | Bets | Avg Model P | Actual Win Rate | Overconfidence Gap | Avg Book P | Avg Edge | Total Profit | ROI / Yield | Log Loss | Brier Score |');
  console.log('| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |');

  edgeBuckets.forEach(b => {
    const sub = awayBets.filter(rec => rec.edge >= b.min && rec.edge < b.max);
    const m = calculateBinMetrics(sub);
    if (m.count > 0) {
      console.log(`| **${b.label}** | ${m.count.toLocaleString()} | ${m.avgModelP} | **${m.winRate}** | **${m.overconfidenceGap}** | ${m.avgBookP} | ${m.avgEdge} | ${m.profit} | **${m.roi}** | ${m.logLoss} | ${m.brier} |`);
    }
  });

  // --- BREAKDOWN 4: BY ELO DIFFERENCE BUCKETS (Elo_Home - Elo_Away) ---
  console.log('\n========================================================================================');
  console.log(' 📌 BREAKDOWN 4: AWAY BETS BY ELO DIFFERENCE BUCKET (Elo_Home - Elo_Away) ');
  console.log('========================================================================================\n');

  const eloDiffBuckets = [
    { label: '< -200 (Away Heavily Stronger)', min: -999, max: -200 },
    { label: '-200 to -50 (Away Stronger)', min: -200, max: -50 },
    { label: '-50 to +50 (Even Match)', min: -50, max: 50 },
    { label: '+50 to +200 (Home Stronger)', min: 50, max: 200 },
    { label: '> +200 (Home Heavily Stronger)', min: 200, max: 999 }
  ];

  console.log('| Elo Diff Bucket | Bets | Avg Model P | Actual Win Rate | Overconfidence Gap | Avg Book P | Avg Edge | Total Profit | ROI / Yield | Log Loss | Brier Score |');
  console.log('| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |');

  eloDiffBuckets.forEach(b => {
    const sub = awayBets.filter(rec => rec.eloDiff >= b.min && rec.eloDiff < b.max);
    const m = calculateBinMetrics(sub);
    if (m.count > 0) {
      console.log(`| **${b.label}** | ${m.count.toLocaleString()} | ${m.avgModelP} | **${m.winRate}** | **${m.overconfidenceGap}** | ${m.avgBookP} | ${m.avgEdge} | ${m.profit} | **${m.roi}** | ${m.logLoss} | ${m.brier} |`);
    }
  });

  // --- BREAKDOWN 5: BY PREDICTION MODE & SAMPLE SIZE ---
  console.log('\n========================================================================================');
  console.log(' 📌 BREAKDOWN 5: AWAY BETS BY PREDICTION MODE & SAMPLE SIZE ');
  console.log('========================================================================================\n');

  const modeBuckets = [
    { label: 'FULL_HISTORY (Both N >= 50)', filter: r => r.mode === 'FULL_HISTORY' },
    { label: 'COLD_START (Min N < 50)', filter: r => r.mode === 'COLD_START' },
    { label: 'Sample Size N < 20', filter: r => r.sampleSize < 20 },
    { label: 'Sample Size 20 <= N < 50', filter: r => r.sampleSize >= 20 && r.sampleSize < 50 },
    { label: 'Sample Size N >= 50', filter: r => r.sampleSize >= 50 }
  ];

  console.log('| Category | Bets | Avg Model P | Actual Win Rate | Overconfidence Gap | Avg Book P | Avg Edge | Total Profit | ROI / Yield | Log Loss | Brier Score |');
  console.log('| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |');

  modeBuckets.forEach(b => {
    const sub = awayBets.filter(b.filter);
    const m = calculateBinMetrics(sub);
    if (m.count > 0) {
      console.log(`| **${b.label}** | ${m.count.toLocaleString()} | ${m.avgModelP} | **${m.winRate}** | **${m.overconfidenceGap}** | ${m.avgBookP} | ${m.avgEdge} | ${m.profit} | **${m.roi}** | ${m.logLoss} | ${m.brier} |`);
    }
  });

  console.log('\n========================================================================================\n');
}

runAwayDiagnostic().catch(err => {
  console.error('Away diagnostic failed:', err);
  process.exit(1);
});
