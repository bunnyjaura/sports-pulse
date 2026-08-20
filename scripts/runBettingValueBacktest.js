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

async function runBettingBacktest() {
  console.log('========================================================================================');
  console.log(' 💰 RIGOROUS HISTORICAL BETTING-VALUE WALK-FORWARD BACKTEST ');
  console.log('========================================================================================\n');

  const { matches: rawMatches } = HistoricalDataService.loadDataset();
  const validMatches = rawMatches.filter(m => {
    const ftr = normalizeResultCode(m.FTR || m.ftr || (m.homeGoals > m.awayGoals ? 'H' : (m.awayGoals > m.homeGoals ? 'A' : 'D')));
    const normDate = normalizeKickoffDate(m.kickoffAt || m.date);
    return ftr !== null && normDate.isValid;
  }).sort((a, b) => normalizeKickoffDate(a.kickoffAt || a.date).timestampMs - normalizeKickoffDate(b.kickoffAt || b.date).timestampMs);

  console.log(`Total Chronological Matches: ${validMatches.length.toLocaleString()}`);

  const matchesWithOdds = validMatches.filter(m => extractBookmakerOdds(m).isValid);
  console.log(`Fixtures with Valid Pre-Kickoff Bookmaker Odds: ${matchesWithOdds.length.toLocaleString()}\n`);

  // Incremental Pre-Match State
  const eloDb = {};
  const teamStats = {};
  let totalHomeGoals = 0;
  let totalAwayGoals = 0;
  let totalMatchCount = 0;

  const BURN_IN = 1000;

  // Initialize burn-in matches
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
  }

  // Minimum Edge Thresholds to test: 0%, 2%, 3%, 5%, 7%, 10%
  const THRESHOLDS = [0.00, 0.02, 0.03, 0.05, 0.07, 0.10];

  const thresholdResults = THRESHOLDS.map(t => ({
    threshold: t,
    bets: 0,
    wins: 0,
    profit: 0,
    sumOdds: 0,
    sumModelP: 0,
    sumBookP: 0,
    peakProfit: 0,
    maxDrawdown: 0,
    currentStreak: 0,
    maxLosingStreak: 0,
    byClass: { H: { bets: 0, profit: 0 }, D: { bets: 0, profit: 0 }, A: { bets: 0, profit: 0 } },
    byLeague: {},
    byYear: {}
  }));

  // Baseline Strategy Tracking
  const baselines = {
    bookmakerFavorite: { name: 'Bet Every Bookmaker Favorite', bets: 0, wins: 0, profit: 0, maxDrawdown: 0, peak: 0 },
    modelFavorite: { name: 'Bet Highest Probability Model Outcome', bets: 0, wins: 0, profit: 0, maxDrawdown: 0, peak: 0 },
    eloValueBetting: { name: 'Elo-Only Value Betting (EV > 3%)', bets: 0, wins: 0, profit: 0, maxDrawdown: 0, peak: 0 },
    raw8020ValueBetting: { name: 'Raw 80/20 Model Value Betting (EV > 3%)', bets: 0, wins: 0, profit: 0, maxDrawdown: 0, peak: 0 },
    calibrated8020ValueBetting: { name: 'Calibrated 80/20 Model (T=1.25, EV > 3%)', bets: 0, wins: 0, profit: 0, maxDrawdown: 0, peak: 0 }
  };

  const evalMatches = validMatches.slice(BURN_IN);
  let totalEvaluatedWithOdds = 0;

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

    // If pre-kickoff odds exist, evaluate betting strategy
    if (bookOdds.isValid) {
      totalEvaluatedWithOdds++;

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

      // 80/20 Raw Model
      const pRaw8020 = {
        home: 0.80 * pElo.home + 0.20 * pDc.home,
        draw: 0.80 * pElo.draw + 0.20 * pDc.draw,
        away: 0.80 * pElo.away + 0.20 * pDc.away
      };
      const sumRaw = pRaw8020.home + pRaw8020.draw + pRaw8020.away;
      pRaw8020.home /= sumRaw; pRaw8020.draw /= sumRaw; pRaw8020.away /= sumRaw;

      // 80/20 Calibrated Model (T=1.25)
      const pCalibrated = applyTemperatureScaling(pRaw8020, 1.25);

      const year = (targetMatch.kickoffAt || targetMatch.date || '2024').substring(0, 4);
      const league = targetMatch.leagueId || 'ENG_PL';

      // --- EVALUATE MULTIPLE EDGE THRESHOLDS FOR CALIBRATED MODEL ---
      THRESHOLDS.forEach((thresh, idx) => {
        const res = thresholdResults[idx];

        // Find outcome with highest expected value (EV = p * odds - 1)
        const evH = (pCalibrated.home * bookOdds.odds.H) - 1.0;
        const evD = (pCalibrated.draw * bookOdds.odds.D) - 1.0;
        const evA = (pCalibrated.away * bookOdds.odds.A) - 1.0;

        let selected = null;
        let maxEv = thresh;

        if (evH > maxEv) { selected = 'H'; maxEv = evH; }
        if (evD > maxEv) { selected = 'D'; maxEv = evD; }
        if (evA > maxEv) { selected = 'A'; maxEv = evA; }

        if (selected) {
          res.bets++;
          const pModel = selected === 'H' ? pCalibrated.home : (selected === 'D' ? pCalibrated.draw : pCalibrated.away);
          const pBookNorm = bookOdds.normProb[selected];
          const odds = bookOdds.odds[selected];

          res.sumOdds += odds;
          res.sumModelP += pModel;
          res.sumBookP += pBookNorm;

          const win = actualResult === selected;
          const pnl = win ? (odds - 1.0) : -1.0;
          res.profit += pnl;

          if (win) {
            res.wins++;
            res.currentStreak = 0;
          } else {
            res.currentStreak++;
            if (res.currentStreak > res.maxLosingStreak) res.maxLosingStreak = res.currentStreak;
          }

          if (res.profit > res.peakProfit) res.peakProfit = res.profit;
          const dd = res.peakProfit - res.profit;
          if (dd > res.maxDrawdown) res.maxDrawdown = dd;

          // Breakdown tracking
          res.byClass[selected].bets++;
          res.byClass[selected].profit += pnl;

          if (!res.byLeague[league]) res.byLeague[league] = { bets: 0, profit: 0 };
          res.byLeague[league].bets++;
          res.byLeague[league].profit += pnl;

          if (!res.byYear[year]) res.byYear[year] = { bets: 0, profit: 0 };
          res.byYear[year].bets++;
          res.byYear[year].profit += pnl;
        }
      });

      // --- BASELINE STRATEGIES EVALUATION ---
      // 1. Bet Bookmaker Favorite
      let bookFav = 'H';
      let minOdds = bookOdds.odds.H;
      if (bookOdds.odds.D < minOdds) { bookFav = 'D'; minOdds = bookOdds.odds.D; }
      if (bookOdds.odds.A < minOdds) { bookFav = 'A'; minOdds = bookOdds.odds.A; }

      const bFavPnl = actualResult === bookFav ? (minOdds - 1.0) : -1.0;
      baselines.bookmakerFavorite.bets++;
      baselines.bookmakerFavorite.profit += bFavPnl;
      if (actualResult === bookFav) baselines.bookmakerFavorite.wins++;
      if (baselines.bookmakerFavorite.profit > baselines.bookmakerFavorite.peak) baselines.bookmakerFavorite.peak = baselines.bookmakerFavorite.profit;
      const bFavDd = baselines.bookmakerFavorite.peak - baselines.bookmakerFavorite.profit;
      if (bFavDd > baselines.bookmakerFavorite.maxDrawdown) baselines.bookmakerFavorite.maxDrawdown = bFavDd;

      // 2. Bet Model Favorite
      let modelFav = 'H';
      let maxP = pCalibrated.home;
      if (pCalibrated.draw > maxP) { modelFav = 'D'; maxP = pCalibrated.draw; }
      if (pCalibrated.away > maxP) { modelFav = 'A'; maxP = pCalibrated.away; }
      const mFavOdds = bookOdds.odds[modelFav];
      const mFavPnl = actualResult === modelFav ? (mFavOdds - 1.0) : -1.0;
      baselines.modelFavorite.bets++;
      baselines.modelFavorite.profit += mFavPnl;
      if (actualResult === modelFav) baselines.modelFavorite.wins++;
      if (baselines.modelFavorite.profit > baselines.modelFavorite.peak) baselines.modelFavorite.peak = baselines.modelFavorite.profit;
      const mFavDd = baselines.modelFavorite.peak - baselines.modelFavorite.profit;
      if (mFavDd > baselines.modelFavorite.maxDrawdown) baselines.modelFavorite.maxDrawdown = mFavDd;

      // 3. Elo-Only Value Betting (EV > 3%)
      const evalValueBet = (baseKey, probsMap) => {
        let bestSel = null;
        let maxE = 0.03;
        ['H', 'D', 'A'].forEach(k => {
          const ev = (probsMap[k === 'H' ? 'home' : (k === 'D' ? 'draw' : 'away')] * bookOdds.odds[k]) - 1.0;
          if (ev > maxE) { bestSel = k; maxE = ev; }
        });
        if (bestSel) {
          const odds = bookOdds.odds[bestSel];
          const pnl = actualResult === bestSel ? (odds - 1.0) : -1.0;
          const b = baselines[baseKey];
          b.bets++;
          b.profit += pnl;
          if (actualResult === bestSel) b.wins++;
          if (b.profit > b.peak) b.peak = b.profit;
          const dd = b.peak - b.profit;
          if (dd > b.maxDrawdown) b.maxDrawdown = dd;
        }
      };

      evalValueBet('eloValueBetting', pElo);
      evalValueBet('raw8020ValueBetting', pRaw8020);
      evalValueBet('calibrated8020ValueBetting', pCalibrated);
    }

    // Advance State Post-Kickoff (t >= T)
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
  }

  console.log('========================================================================================');
  console.log(' 📈 VALUE BETTING PERFORMANCE BY MINIMUM EDGE THRESHOLD (1-UNIT FLAT STAKES) ');
  console.log('========================================================================================\n');

  console.log('| EV Threshold | Bets | Win Rate | Total Profit | ROI / Yield | Avg Odds | Avg Model P | Avg Book P | Max Drawdown | Max Losing Streak |');
  console.log('| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |');

  thresholdResults.forEach(r => {
    const winRate = r.bets > 0 ? ((r.wins / r.bets) * 100).toFixed(2) + '%' : 'N/A';
    const roi = r.bets > 0 ? ((r.profit / r.bets) * 100).toFixed(2) + '%' : 'N/A';
    const avgOdds = r.bets > 0 ? (r.sumOdds / r.bets).toFixed(2) : 'N/A';
    const avgModelP = r.bets > 0 ? ((r.sumModelP / r.bets) * 100).toFixed(1) + '%' : 'N/A';
    const avgBookP = r.bets > 0 ? ((r.sumBookP / r.bets) * 100).toFixed(1) + '%' : 'N/A';
    const profStr = r.profit >= 0 ? `+${r.profit.toFixed(2)}u` : `${r.profit.toFixed(2)}u`;

    console.log(`| **> ${(r.threshold * 100).toFixed(0)}% EV** | ${r.bets.toLocaleString()} | **${winRate}** | **${profStr}** | **${roi}** | ${avgOdds} | ${avgModelP} | ${avgBookP} | ${r.maxDrawdown.toFixed(2)}u | ${r.maxLosingStreak} |`);
  });

  console.log('\n========================================================================================');
  console.log(' 🏆 STRATEGY COMPARISON & BASELINES LEADERBOARD ');
  console.log('========================================================================================\n');

  console.log('| Strategy Name | Bets Placed | Win Rate | Total Profit (Units) | ROI / Yield (%) | Max Drawdown (Units) |');
  console.log('| :--- | :---: | :---: | :---: | :---: | :---: |');

  Object.values(baselines).forEach(b => {
    const winRate = b.bets > 0 ? ((b.wins / b.bets) * 100).toFixed(2) + '%' : 'N/A';
    const roi = b.bets > 0 ? ((b.profit / b.bets) * 100).toFixed(2) + '%' : 'N/A';
    const profStr = b.profit >= 0 ? `+${b.profit.toFixed(2)}u` : `${b.profit.toFixed(2)}u`;
    console.log(`| **${b.name}** | ${b.bets.toLocaleString()} | ${winRate} | **${profStr}** | **${roi}** | ${b.maxDrawdown.toFixed(2)}u |`);
  });

  // Breakdown for >3% EV Threshold
  const ev3 = thresholdResults[2]; // >3% EV
  console.log('\n========================================================================================');
  console.log(' 📊 DETAILED BREAKDOWN FOR >3% EV THRESHOLD BY OUTCOME CLASS & SEASONS ');
  console.log('========================================================================================\n');

  console.log('--- Profit / Loss by Outcome Class ---');
  ['H', 'D', 'A'].forEach(c => {
    const name = c === 'H' ? 'Home' : (c === 'D' ? 'Draw' : 'Away');
    const s = ev3.byClass[c];
    const roi = s.bets > 0 ? ((s.profit / s.bets) * 100).toFixed(2) + '%' : 'N/A';
    console.log(`  • ${name}: ${s.bets.toLocaleString()} bets, ${s.profit >= 0 ? '+' : ''}${s.profit.toFixed(2)}u profit, ROI: ${roi}`);
  });

  console.log('\n--- Profit / Loss by Year ---');
  Object.keys(ev3.byYear).sort().forEach(yr => {
    const s = ev3.byYear[yr];
    const roi = s.bets > 0 ? ((s.profit / s.bets) * 100).toFixed(2) + '%' : 'N/A';
    console.log(`  • Year ${yr}: ${s.bets.toLocaleString()} bets, ${s.profit >= 0 ? '+' : ''}${s.profit.toFixed(2)}u profit, ROI: ${roi}`);
  });

  console.log('\n========================================================================================\n');
}

runBettingBacktest().catch(err => {
  console.error('Betting backtest failed:', err);
  process.exit(1);
});
